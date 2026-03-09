/**
 * Cuando Juega — Renderer Process (Vercel Design System)
 */

// DOM Elements
const teamSelect = document.getElementById('teamSelect');
const searchBtn = document.getElementById('searchBtn');
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const resultsContainer = document.getElementById('resultsContainer');
const retryBtnError = document.getElementById('retryBtnError');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');

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
  resultsContainer.classList.remove('visible');

  if (state === 'loading') {
    loadingState.classList.add('visible');
  } else if (state === 'error') {
    errorState.classList.add('visible');
  } else if (state === 'result') {
    resultsContainer.classList.add('visible');
  }
  // 'idle' shows nothing
}

// ===========================
// Date Formatting
// ===========================

/**
 * Formats time in ART (UTC-3).
 * Example: "19:45"
 */
function formatTimeART(date) {
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  };
  return date.toLocaleTimeString('es-AR', options);
}

/**
 * Formats a short date for the card line.
 * Example: "Mié 11 Mar 2026"
 */
function formatShortDate(date) {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Convert to ART
  const artDate = new Date(
    date.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  );

  const dayName = days[artDate.getDay()];
  const day = artDate.getDate();
  const month = months[artDate.getMonth()];
  const year = artDate.getFullYear();

  return `${dayName} ${day} ${month} ${year}`;
}

/**
 * Returns a relative date string like "en 3 días" or "hoy".
 */
function getRelativeDate(date) {
  const now = new Date();

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
    if (diffHours <= 0) return 'ahora';
    if (diffHours === 1) return 'en 1 hora';
    return `en ${diffHours} horas`;
  } else if (diffDays === 1) {
    return 'mañana';
  } else if (diffDays === -1) {
    return 'ayer';
  } else if (diffDays > 1) {
    return `en ${diffDays} días`;
  } else {
    return `hace ${Math.abs(diffDays)} días`;
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
    displayMatch(match, true);
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

/**
 * Build and display a match card.
 * @param {object} match - Match data
 * @param {boolean} isFirst - Whether this is the first (next) match
 */
function displayMatch(match, isFirst) {
  const matchDate = new Date(match.date);

  // Clear previous results
  resultsContainer.innerHTML = '';

  const card = document.createElement('div');
  card.className = isFirst ? 'match-card next-match' : 'match-card';

  let html = '';

  // Next match pill (only for the first card)
  if (isFirst) {
    html += '<div class="next-pill">PRÓXIMO</div>';
  }

  // Tournament
  html += `<div class="match-tournament">${escapeHtml(match.competition)}</div>`;

  // Teams — "Equipo A  —  Equipo B" with em dash
  const homeTeam = match.homeTeam;
  const awayTeam = match.awayTeam;
  html += `<div class="match-teams">${escapeHtml(homeTeam)}  &mdash;  ${escapeHtml(awayTeam)}</div>`;

  // Time + date on one line: "19:45  ·  Mié 11 Mar 2026"
  const time = formatTimeART(matchDate);
  const shortDate = formatShortDate(matchDate);
  html += `<div class="match-datetime">${time}  &middot;  ${shortDate}</div>`;

  // Relative time: "en 2 días"
  const relative = getRelativeDate(matchDate);
  html += `<div class="match-relative">${escapeHtml(relative)}</div>`;

  card.innerHTML = html;
  resultsContainer.appendChild(card);

  showState('result');
}

/**
 * Simple HTML escape helper.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
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
