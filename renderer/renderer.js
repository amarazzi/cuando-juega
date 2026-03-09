/**
 * ¿Cuándo Juega? — Renderer Process
 */

// Team primary colors for the card accent border
const TEAM_COLORS = {
  'River Plate': '#d62828',
  'Boca Juniors': '#003da5',
  'Racing Club': '#6cb4ee',
  'Independiente': '#c8102e',
  'San Lorenzo': '#1c3b6e',
  'Huracán': '#ffffff',
  'Vélez Sársfield': '#003da5',
  'Estudiantes': '#d62828',
  'Lanús': '#8b0000',
  'Defensa y Justicia': '#2e7d32',
  'Talleres': '#1c3b6e',
  'Belgrano': '#6cb4ee',
  'Godoy Cruz': '#ffffff',
  "Newell's Old Boys": '#d62828',
  'Rosario Central': '#f5e642',
  'Tigre': '#003da5',
  'Banfield': '#2e7d32',
  'Gimnasia LP': '#1c3b6e',
  'Arsenal de Sarandí': '#6cb4ee',
  'Platense': '#8b4513',
  'Barracas Central': '#d62828',
  'Riestra': '#d62828',
  'Central Córdoba': '#1a1a1a',
  'Instituto': '#d62828',
};

// DOM Elements
const teamSelect = document.getElementById('teamSelect');
const searchBtn = document.getElementById('searchBtn');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const resultCard = document.getElementById('resultCard');
const cardAccent = document.getElementById('cardAccent');
const retryBtnError = document.getElementById('retryBtnError');
const refreshBtn = document.getElementById('refreshBtn');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');

// Result card elements
const competitionEl = document.getElementById('competition');
const homeTeamEl = document.getElementById('homeTeam');
const awayTeamEl = document.getElementById('awayTeam');
const matchTimeEl = document.getElementById('matchTime');
const matchDateEl = document.getElementById('matchDate');
const relativeDateEl = document.getElementById('relativeDate');
const venueNameEl = document.getElementById('venueName');
const venueCityEl = document.getElementById('venueCity');
const dataSourceEl = document.getElementById('dataSource');

let currentTeam = '';

// ===========================
// Initialize
// ===========================

async function init() {
  try {
    const teams = await window.api.getTeamNames();
    teams.sort((a, b) => a.localeCompare(b, 'es'));
    teams.forEach((team) => {
      const option = document.createElement('option');
      option.value = team;
      option.textContent = team;
      teamSelect.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load team names:', err);
  }
}

// ===========================
// State Management
// ===========================

function showState(state) {
  loadingState.classList.remove('visible');
  errorState.classList.remove('visible');
  resultCard.classList.remove('visible');

  if (state === 'loading') {
    loadingState.classList.add('visible');
  } else if (state === 'error') {
    errorState.classList.add('visible');
  } else if (state === 'result') {
    resultCard.classList.add('visible');
  }
  // 'idle' shows nothing
}

// ===========================
// Date Formatting
// ===========================

/**
 * Formats a date to Spanish Argentina locale.
 * Example: "Sábado 15 de marzo de 2025"
 */
function formatDateSpanish(date) {
  const options = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  };

  let formatted = date.toLocaleDateString('es-AR', options);
  // Capitalize first letter
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  return formatted;
}

/**
 * Formats the time in ART (UTC-3).
 * Example: "20:00 HS"
 */
function formatTimeART(date) {
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  };

  const time = date.toLocaleTimeString('es-AR', options);
  return `${time} HS`;
}

/**
 * Returns a relative date string like "en 3 días" or "hace 2 días".
 */
function getRelativeDate(date) {
  const now = new Date();

  // Convert both to ART for comparison
  const artNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const artMatch = new Date(
    date.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  );

  const diffMs = artMatch.getTime() - artNow.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) return 'AHORA';
    if (diffHours === 1) return 'EN 1 HORA';
    if (diffHours > 1) return `EN ${diffHours} HORAS`;
    if (diffHours === -1) return 'HACE 1 HORA';
    return `HACE ${Math.abs(diffHours)} HORAS`;
  } else if (diffDays === 1) {
    return 'MAÑANA';
  } else if (diffDays === -1) {
    return 'AYER';
  } else if (diffDays > 1) {
    return `EN ${diffDays} DÍAS`;
  } else {
    return `HACE ${Math.abs(diffDays)} DÍAS`;
  }
}

// ===========================
// Fetch & Display
// ===========================

async function searchMatch() {
  const teamName = teamSelect.value;
  if (!teamName) return;

  currentTeam = teamName;
  searchBtn.disabled = true;
  showState('loading');

  try {
    const response = await window.api.fetchNextMatch(teamName);

    if (!response.success) {
      throw new Error(response.error);
    }

    const match = response.data;
    displayMatch(match, teamName);
  } catch (err) {
    let msg = err.message || 'Error desconocido';

    if (msg.includes('ENOTFOUND') || msg.includes('ENETUNREACH') || msg.includes('network')) {
      msg = 'Sin conexión a internet. Verificá tu conexión e intentá de nuevo.';
    } else if (msg.includes('No se encontraron')) {
      msg = `${teamName} no tiene próximos partidos programados por el momento.`;
    }

    errorMessage.textContent = msg;
    showState('error');
  } finally {
    searchBtn.disabled = false;
  }
}

function displayMatch(match, teamName) {
  const matchDate = new Date(match.date);

  // Set accent color
  const color = TEAM_COLORS[teamName] || '#f5e642';
  cardAccent.style.background = color;

  // Populate card
  competitionEl.textContent = match.competition;
  homeTeamEl.textContent = match.homeTeam.toUpperCase();
  awayTeamEl.textContent = match.awayTeam.toUpperCase();
  matchTimeEl.textContent = formatTimeART(matchDate);
  matchDateEl.textContent = formatDateSpanish(matchDate);
  relativeDateEl.textContent = getRelativeDate(matchDate);

  venueNameEl.textContent = match.venue || 'POR CONFIRMAR';
  venueCityEl.textContent = match.city || '';

  dataSourceEl.textContent = `FUENTE: ${match.source}`;

  showState('result');
}

// ===========================
// Event Listeners
// ===========================

searchBtn.addEventListener('click', searchMatch);

teamSelect.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    searchMatch();
  }
});

retryBtnError.addEventListener('click', () => {
  if (currentTeam) {
    teamSelect.value = currentTeam;
    searchMatch();
  }
});

refreshBtn.addEventListener('click', () => {
  if (currentTeam) {
    searchMatch();
  }
});

minimizeBtn.addEventListener('click', () => {
  window.api.minimizeWindow();
});

closeBtn.addEventListener('click', () => {
  window.api.closeWindow();
});

// ===========================
// Init
// ===========================

init();
