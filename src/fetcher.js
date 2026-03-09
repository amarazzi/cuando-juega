const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Map of Argentine Primera División team names to their SofaScore team slugs and IDs.
 * These are used to query the SofaScore public API for upcoming matches.
 */
const TEAM_MAP = {
  'River Plate': { slug: 'river-plate', id: 3211 },
  'Boca Juniors': { slug: 'boca-juniors', id: 3212 },
  'Racing Club': { slug: 'racing-club', id: 3218 },
  'Independiente': { slug: 'independiente', id: 3216 },
  'San Lorenzo': { slug: 'san-lorenzo', id: 3213 },
  'Huracán': { slug: 'huracan', id: 3223 },
  'Vélez Sársfield': { slug: 'velez-sarsfield', id: 3220 },
  'Estudiantes': { slug: 'estudiantes-de-la-plata', id: 3215 },
  'Lanús': { slug: 'lanus', id: 3222 },
  'Defensa y Justicia': { slug: 'defensa-y-justicia', id: 35439 },
  'Talleres': { slug: 'talleres', id: 3229 },
  'Belgrano': { slug: 'belgrano', id: 3232 },
  'Godoy Cruz': { slug: 'godoy-cruz', id: 3233 },
  "Newell's Old Boys": { slug: 'newells-old-boys', id: 3217 },
  'Rosario Central': { slug: 'rosario-central', id: 3219 },
  'Tigre': { slug: 'tigre', id: 3228 },
  'Banfield': { slug: 'banfield', id: 3221 },
  'Gimnasia LP': { slug: 'gimnasia-la-plata', id: 3214 },
  'Arsenal de Sarandí': { slug: 'arsenal-de-sarandi', id: 3224 },
  'Platense': { slug: 'platense', id: 3237 },
  'Barracas Central': { slug: 'barracas-central', id: 124127 },
  'Riestra': { slug: 'deportivo-riestra', id: 116498 },
  'Central Córdoba': { slug: 'central-cordoba-de-santiago', id: 80786 },
  'Instituto': { slug: 'instituto', id: 3242 },
};

/**
 * Returns the list of all available team names.
 */
function getTeamNames() {
  return Object.keys(TEAM_MAP);
}

/**
 * Fetches the next match for the given team using SofaScore public API.
 * @param {string} teamName - The display name of the team
 * @returns {Promise<object>} Match data object
 */
async function fetchNextMatch(teamName) {
  const teamInfo = TEAM_MAP[teamName];
  if (!teamInfo) {
    throw new Error(`Equipo no encontrado: ${teamName}`);
  }

  // Try SofaScore API first
  try {
    const result = await fetchFromSofaScore(teamInfo, teamName);
    if (result) return result;
  } catch (err) {
    console.error('SofaScore fetch failed:', err.message);
  }

  // Fallback: try scraping from Livefutbol
  try {
    const result = await fetchFromLivefutbol(teamName);
    if (result) return result;
  } catch (err) {
    console.error('Livefutbol fetch failed:', err.message);
  }

  throw new Error(`No se encontraron próximos partidos para ${teamName}.`);
}

/**
 * Fetch next match from SofaScore public API endpoints.
 */
async function fetchFromSofaScore(teamInfo, teamName) {
  const url = `https://www.sofascore.com/api/v1/team/${teamInfo.id}/events/next/0`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'es-AR,es;q=0.9',
      'Referer': 'https://www.sofascore.com/',
      'Origin': 'https://www.sofascore.com',
    },
    timeout: 10000,
  });

  const events = response.data?.events;
  if (!events || events.length === 0) {
    return null;
  }

  // Find the first event that hasn't finished yet
  const now = Math.floor(Date.now() / 1000);
  const nextEvent = events.find(
    (e) => e.status?.type === 'notstarted' || (e.startTimestamp && e.startTimestamp > now)
  );

  if (!nextEvent) {
    return null;
  }

  const homeTeam = nextEvent.homeTeam?.name || 'Desconocido';
  const awayTeam = nextEvent.awayTeam?.name || 'Desconocido';
  const competition = nextEvent.tournament?.name || 'Competencia desconocida';
  const competitionSeason = nextEvent.season?.name || '';
  const venue = nextEvent.venue?.stadium?.name || nextEvent.venue?.name || 'Estadio no disponible';
  const city = nextEvent.venue?.city?.name || nextEvent.venue?.name || '';
  const startTimestamp = nextEvent.startTimestamp;

  // Convert timestamp to Argentina time
  const matchDate = new Date(startTimestamp * 1000);

  return {
    homeTeam,
    awayTeam,
    competition: competitionSeason ? `${competition} - ${competitionSeason}` : competition,
    date: matchDate.toISOString(),
    timestamp: startTimestamp,
    venue,
    city,
    source: 'SofaScore',
  };
}

/**
 * Fallback: fetch from Livefutbol by scraping.
 */
async function fetchFromLivefutbol(teamName) {
  // Normalize team name for search
  const searchTerm = teamName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-');

  const url = `https://www.livefutbol.com/equipo/${searchTerm}/`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'es-AR,es;q=0.9',
    },
    timeout: 10000,
  });

  const $ = cheerio.load(response.data);

  // Try to find upcoming matches in the page
  const matchElements = $('.match-row, .fixture-row, .next-match');
  if (matchElements.length === 0) {
    return null;
  }

  const firstMatch = matchElements.first();
  const homeTeam = firstMatch.find('.home-team, .team-home').text().trim() || teamName;
  const awayTeam = firstMatch.find('.away-team, .team-away').text().trim() || 'Rival';
  const competition = firstMatch.find('.competition, .league').text().trim() || 'Liga Profesional';
  const dateStr = firstMatch.find('.date, .match-date').text().trim();
  const timeStr = firstMatch.find('.time, .match-time').text().trim();
  const venue = firstMatch.find('.venue, .stadium').text().trim() || 'Estadio no disponible';

  // Parse the date if available
  let matchDate;
  if (dateStr) {
    matchDate = new Date(dateStr);
  } else {
    matchDate = new Date();
  }

  return {
    homeTeam,
    awayTeam,
    competition,
    date: matchDate.toISOString(),
    timestamp: Math.floor(matchDate.getTime() / 1000),
    venue,
    city: '',
    source: 'Livefutbol',
  };
}

module.exports = { fetchNextMatch, getTeamNames, TEAM_MAP };
