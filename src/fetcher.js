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
      (c) => String(c.id) === teamId
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

module.exports = { fetchNextMatch, getTeamNames, TEAM_MAP };
