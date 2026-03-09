const axios = require('axios');

/**
 * Map of Argentine Primera División team names to their ESPN team IDs.
 * Source: https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams
 * ESPN's public API requires no authentication or API keys.
 */
const TEAM_MAP = {
  'River Plate': { id: 16 },
  'Boca Juniors': { id: 5 },
  'Racing Club': { id: 15 },
  'Independiente': { id: 11 },
  'San Lorenzo': { id: 18 },
  'Huracán': { id: 10 },
  'Vélez Sársfield': { id: 21 },
  'Estudiantes': { id: 8 },
  'Lanús': { id: 12 },
  'Defensa y Justicia': { id: 8950 },
  'Talleres': { id: 19 },
  'Belgrano': { id: 4 },
  'Godoy Cruz': { id: 9739 },
  "Newell's Old Boys": { id: 14 },
  'Rosario Central': { id: 17 },
  'Tigre': { id: 7767 },
  'Banfield': { id: 235 },
  'Gimnasia LP': { id: 9 },
  'Arsenal de Sarandí': { id: 3 },
  'Platense': { id: 7764 },
  'Barracas Central': { id: 10060 },
  'Riestra': { id: 17702 },
  'Central Córdoba': { id: 11989 },
  'Instituto': { id: 2975 },
};

/**
 * Returns the list of all available team names.
 */
function getTeamNames() {
  return Object.keys(TEAM_MAP);
}

/**
 * Fetches the next match for the given team using ESPN's public API.
 * No authentication or API keys required.
 * @param {string} teamName - The display name of the team
 * @returns {Promise<object>} Match data object
 */
async function fetchNextMatch(teamName) {
  const teamInfo = TEAM_MAP[teamName];
  if (!teamInfo) {
    throw new Error(`Equipo no encontrado: ${teamName}`);
  }

  // Try ESPN team detail API (returns nextEvent)
  try {
    const result = await fetchFromESPN(teamInfo, teamName);
    if (result) return result;
  } catch (err) {
    console.error('ESPN team fetch failed:', err.message);
  }

  // Fallback: try ESPN scoreboard for scheduled matches involving the team
  try {
    const result = await fetchFromESPNScoreboard(teamInfo, teamName);
    if (result) return result;
  } catch (err) {
    console.error('ESPN scoreboard fetch failed:', err.message);
  }

  throw new Error(`No se encontraron próximos partidos para ${teamName}.`);
}

/**
 * Fetches the next 3 matches for the given team.
 * @param {string} teamName - The display name of the team
 * @returns {Promise<object[]>} Array of match data objects (up to 3)
 */
async function fetchNextMatches(teamName) {
  const teamInfo = TEAM_MAP[teamName];
  if (!teamInfo) {
    throw new Error(`Equipo no encontrado: ${teamName}`);
  }

  try {
    const results = await fetchMultipleFromESPN(teamInfo, teamName);
    if (results && results.length > 0) return results;
  } catch (err) {
    console.error('ESPN multi-match fetch failed:', err.message);
  }

  // Fallback to single match
  const single = await fetchNextMatch(teamName);
  return [single];
}

/**
 * Fetch up to 3 next matches by scanning ESPN scoreboard in parallel batches.
 * The /schedule endpoint doesn't reliably return future events,
 * so we query the scoreboard for each day over the next 30 days
 * and collect matches involving our team.
 * Requests are batched in groups of 5 for parallelism.
 */
async function fetchMultipleFromESPN(teamInfo, teamName) {
  const teamId = String(teamInfo.id);
  const now = new Date();
  const matches = [];

  // Generate date strings for next 30 days (YYYYMMDD format)
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    dates.push(`${yyyy}${mm}${dd}`);
  }

  // Fetch a single date's scoreboard and extract matching events
  async function fetchDate(date) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard?dates=${date}`;
    try {
      const response = await axios.get(url, {
        headers: { 'Accept': 'application/json' },
        timeout: 10000,
      });
      return response.data?.events || [];
    } catch (err) {
      console.error(`Scoreboard fetch failed for ${date}:`, err.message);
      return [];
    }
  }

  // Process events from a batch and extract team matches
  function extractMatches(events) {
    const found = [];
    for (const event of events) {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors || [];
      const involvesTeam = competitors.some((c) => String(c.team?.id) === teamId);

      if (!involvesTeam) continue;

      const eventDate = new Date(event.date);
      if (eventDate <= now) continue;

      const homeCompetitor = competitors.find((c) => c.homeAway === 'home');
      const awayCompetitor = competitors.find((c) => c.homeAway === 'away');

      const homeTeam = homeCompetitor?.team?.displayName || 'Desconocido';
      const awayTeam = awayCompetitor?.team?.displayName || 'Desconocido';

      const seasonSlug = event.season?.slug || '';
      const competitionName = seasonSlug
        ? seasonSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Liga Profesional';

      const venue = competition?.venue?.fullName || 'Estadio no disponible';
      const city = competition?.venue?.address?.city || '';

      found.push({
        homeTeam,
        awayTeam,
        competition: competitionName,
        date: eventDate.toISOString(),
        timestamp: Math.floor(eventDate.getTime() / 1000),
        venue,
        city,
        source: 'ESPN',
      });
    }
    return found;
  }

  // Process dates in batches of 5 for parallel fetching
  const BATCH_SIZE = 5;
  for (let i = 0; i < dates.length; i += BATCH_SIZE) {
    if (matches.length >= 3) break;

    const batch = dates.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(fetchDate));

    // Process results in chronological order
    for (const events of batchResults) {
      if (matches.length >= 3) break;
      const found = extractMatches(events);
      for (const m of found) {
        if (matches.length >= 3) break;
        matches.push(m);
      }
    }
  }

  if (matches.length === 0) return null;

  return matches;
}

/**
 * Fetch next match from ESPN public API (team detail endpoint).
 * This endpoint returns a `nextEvent` array for the team.
 */
async function fetchFromESPN(teamInfo, teamName) {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams/${teamInfo.id}`;

  const response = await axios.get(url, {
    headers: {
      'Accept': 'application/json',
    },
    timeout: 15000,
  });

  const team = response.data?.team;
  const nextEvents = team?.nextEvent;

  if (!nextEvents || nextEvents.length === 0) {
    return null;
  }

  const nextEvent = nextEvents[0];
  const competition = nextEvent.competitions?.[0];

  if (!competition) {
    return null;
  }

  const competitors = competition.competitors || [];
  const homeCompetitor = competitors.find((c) => c.homeAway === 'home');
  const awayCompetitor = competitors.find((c) => c.homeAway === 'away');

  const homeTeam = homeCompetitor?.team?.displayName || 'Desconocido';
  const awayTeam = awayCompetitor?.team?.displayName || 'Desconocido';

  const seasonType = nextEvent.seasonType?.name || '';
  const seasonDisplay = nextEvent.season?.displayName || '';
  const competitionName = seasonType || seasonDisplay || 'Liga Profesional';

  const venue = competition.venue?.fullName || 'Estadio no disponible';
  const city = competition.venue?.address?.city || '';

  const matchDate = new Date(nextEvent.date);

  return {
    homeTeam,
    awayTeam,
    competition: competitionName,
    date: matchDate.toISOString(),
    timestamp: Math.floor(matchDate.getTime() / 1000),
    venue,
    city,
    source: 'ESPN',
  };
}

/**
 * Fallback: fetch from ESPN scoreboard endpoint.
 * Searches current round's matches for the given team.
 */
async function fetchFromESPNScoreboard(teamInfo, teamName) {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/scoreboard';

  const response = await axios.get(url, {
    headers: {
      'Accept': 'application/json',
    },
    timeout: 15000,
  });

  const events = response.data?.events || [];

  // Find a scheduled (not yet played) event involving our team
  const teamId = String(teamInfo.id);
  const matchEvent = events.find((event) => {
    const comp = event.competitions?.[0];
    if (!comp) return false;

    const isScheduled = comp.status?.type?.state === 'pre';
    const involvesTeam = comp.competitors?.some(
      (c) => String(c.team?.id) === teamId
    );

    return isScheduled && involvesTeam;
  });

  if (!matchEvent) {
    return null;
  }

  const comp = matchEvent.competitions[0];
  const competitors = comp.competitors || [];
  const homeCompetitor = competitors.find((c) => c.homeAway === 'home');
  const awayCompetitor = competitors.find((c) => c.homeAway === 'away');

  const homeTeam = homeCompetitor?.team?.displayName || 'Desconocido';
  const awayTeam = awayCompetitor?.team?.displayName || 'Desconocido';

  const competitionName =
    matchEvent.season?.slug?.replace(/-/g, ' ')?.replace(/\b\w/g, (c) => c.toUpperCase()) ||
    'Liga Profesional';

  const venue = comp.venue?.fullName || 'Estadio no disponible';
  const city = comp.venue?.address?.city || '';

  const matchDate = new Date(matchEvent.date);

  return {
    homeTeam,
    awayTeam,
    competition: competitionName,
    date: matchDate.toISOString(),
    timestamp: Math.floor(matchDate.getTime() / 1000),
    venue,
    city,
    source: 'ESPN',
  };
}

module.exports = { fetchNextMatch, fetchNextMatches, getTeamNames, TEAM_MAP };
