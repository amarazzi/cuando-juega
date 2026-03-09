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
const teamInput = document.getElementById('teamInput');
const suggestionsList = document.getElementById('suggestionsList');
const searchBtn = document.getElementById('searchBtn');
const loadingState = document.getElementById('loadingState');
const errorNotFound = document.getElementById('errorNotFound');
const errorNoMatches = document.getElementById('errorNoMatches');
const errorNetwork = document.getElementById('errorNetwork');
const resultsContainer = document.getElementById('resultsContainer');
const retryBtnError = document.getElementById('retryBtnError');
const minimizeBtn = document.getElementById('minimizeBtn');
const closeBtn = document.getElementById('closeBtn');

let currentTeam = '';
let allTeams = [];
let activeSuggestionIndex = -1;

// ===========================
// Initialize
// ===========================

async function init() {
  try {
    const teams = await window.api.getTeamNames();
    teams.sort((a, b) => a.localeCompare(b, 'es'));
    allTeams = teams;
  } catch (err) {
    console.error('Failed to load team names:', err);
  }
}

// ===========================
// Autocomplete
// ===========================

function normalize(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function filterTeams(query) {
  if (!query.trim()) return allTeams;
  const normalizedQuery = normalize(query);
  return allTeams.filter((team) => normalize(team).includes(normalizedQuery));
}

function findExactMatch(query) {
  const normalizedQuery = normalize(query.trim());
  return allTeams.find((team) => normalize(team) === normalizedQuery) || null;
}

function showSuggestions(query) {
  const filtered = filterTeams(query);
  suggestionsList.innerHTML = '';
  activeSuggestionIndex = -1;

  if (filtered.length === 0) {
    suggestionsList.classList.remove('visible');
    return;
  }

  filtered.forEach((team, index) => {
    const li = document.createElement('li');
    li.dataset.index = index;

    const normalizedTeam = normalize(team);
    const normalizedQuery = normalize(query);
    const matchStart = normalizedTeam.indexOf(normalizedQuery);

    if (matchStart >= 0 && query.trim()) {
      const before = escapeHTML(team.substring(0, matchStart));
      const match = escapeHTML(team.substring(matchStart, matchStart + normalizedQuery.length));
      const after = escapeHTML(team.substring(matchStart + normalizedQuery.length));
      li.innerHTML = before + '<span class="match-highlight">' + match + '</span>' + after;
    } else {
      li.textContent = team;
    }

    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      selectTeam(team);
    });

    suggestionsList.appendChild(li);
  });

  suggestionsList.classList.add('visible');
}

function hideSuggestions() {
  suggestionsList.classList.remove('visible');
  activeSuggestionIndex = -1;
}

function selectTeam(teamName) {
  teamInput.value = teamName;
  currentTeam = teamName;
  hideSuggestions();
}

function navigateSuggestions(direction) {
  const items = suggestionsList.querySelectorAll('li');
  if (items.length === 0) return;

  if (activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
    items[activeSuggestionIndex].classList.remove('active');
  }

  activeSuggestionIndex += direction;

  if (activeSuggestionIndex < 0) activeSuggestionIndex = items.length - 1;
  if (activeSuggestionIndex >= items.length) activeSuggestionIndex = 0;

  items[activeSuggestionIndex].classList.add('active');
  items[activeSuggestionIndex].scrollIntoView({ block: 'nearest' });
}

// ===========================
// State Management
// ===========================

function showState(state) {
  loadingState.classList.remove('visible');
  errorNotFound.classList.remove('visible');
  errorNoMatches.classList.remove('visible');
  errorNetwork.classList.remove('visible');
  resultsContainer.classList.remove('visible');

  switch (state) {
    case 'loading':
      loadingState.classList.add('visible');
      break;
    case 'error-not-found':
      errorNotFound.classList.add('visible');
      break;
    case 'error-no-matches':
      errorNoMatches.classList.add('visible');
      break;
    case 'error-network':
      errorNetwork.classList.add('visible');
      break;
    case 'results':
      resultsContainer.classList.add('visible');
      break;
  }
}

// ===========================
// Date Formatting
// ===========================

function formatDateSpanish(date) {
  const options = {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires',
  };

  let formatted = date.toLocaleDateString('es-AR', options);
  formatted = formatted.charAt(0).toUpperCase() + formatted.slice(1);
  return formatted;
}

function formatTimeART(date) {
  const options = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Argentina/Buenos_Aires',
  };

  const time = date.toLocaleTimeString('es-AR', options);
  return time + ' HS';
}

function getRelativeDate(date) {
  const now = new Date();

  const artNow = new Date(
    now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  );
  const artMatch = new Date(
    date.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' })
  );

  const diffMs = artMatch.getTime() - artNow.getTime();

  // Compare calendar dates (not raw time diff) to avoid rounding issues
  // e.g. 8AM now vs 9PM today = 13hrs, Math.round(13/24) = 1 = "MAÑANA" (wrong)
  const artNowDate = new Date(artNow.getFullYear(), artNow.getMonth(), artNow.getDate());
  const artMatchDate = new Date(artMatch.getFullYear(), artMatch.getMonth(), artMatch.getDate());
  const diffDays = Math.round((artMatchDate.getTime() - artNowDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) return 'AHORA';
    if (diffHours === 1) return 'EN 1 HORA';
    if (diffHours > 1) return 'EN ' + diffHours + ' HORAS';
    if (diffHours === -1) return 'HACE 1 HORA';
    return 'HACE ' + Math.abs(diffHours) + ' HORAS';
  } else if (diffDays === 1) {
    return 'MA\u00d1ANA';
  } else if (diffDays === -1) {
    return 'AYER';
  } else if (diffDays > 1) {
    return 'EN ' + diffDays + ' D\u00cdAS';
  } else {
    return 'HACE ' + Math.abs(diffDays) + ' D\u00cdAS';
  }
}

// ===========================
// Fetch & Display
// ===========================

async function searchMatch() {
  const inputValue = teamInput.value.trim();
  if (!inputValue) return;

  hideSuggestions();

  let teamName = findExactMatch(inputValue);
  if (!teamName) {
    const filtered = filterTeams(inputValue);
    if (filtered.length === 1) {
      teamName = filtered[0];
    } else if (filtered.length > 1) {
      showSuggestions(inputValue);
      return;
    }
  }

  if (!teamName) {
    document.getElementById('errorNotFoundMsg').textContent =
      'No se encontr\u00f3 "' + inputValue + '". Revis\u00e1 el nombre e intent\u00e1 de nuevo.';
    showState('error-not-found');
    return;
  }

  teamInput.value = teamName;
  currentTeam = teamName;
  searchBtn.disabled = true;
  showState('loading');

  try {
    const response = await window.api.fetchNextMatches(teamName);

    if (!response.success) {
      throw new Error(response.error);
    }

    const matches = response.data;
    if (!matches || matches.length === 0) {
      document.getElementById('errorNoMatchesMsg').textContent =
        teamName + ' no tiene pr\u00f3ximos partidos agendados por el momento.';
      showState('error-no-matches');
      return;
    }

    displayMatches(matches, teamName);
  } catch (err) {
    const msg = err.message || '';

    if (msg.includes('no encontrado') || msg.includes('not found')) {
      document.getElementById('errorNotFoundMsg').textContent =
        'No se encontr\u00f3 "' + inputValue + '". Revis\u00e1 el nombre e intent\u00e1 de nuevo.';
      showState('error-not-found');
    } else if (msg.includes('ENOTFOUND') || msg.includes('ENETUNREACH') || msg.includes('network') || msg.includes('timeout') || msg.includes('ECONNREFUSED')) {
      showState('error-network');
    } else if (msg.includes('No se encontraron') || msg.includes('no upcoming')) {
      document.getElementById('errorNoMatchesMsg').textContent =
        teamName + ' no tiene pr\u00f3ximos partidos agendados por el momento.';
      showState('error-no-matches');
    } else {
      document.getElementById('errorNetworkMsg').textContent = msg;
      showState('error-network');
    }
  } finally {
    searchBtn.disabled = false;
  }
}

function displayMatches(matches, teamName) {
  resultsContainer.innerHTML = '';

  const color = TEAM_COLORS[teamName] || '#f5e642';

  matches.forEach((match, index) => {
    const isPrimary = index === 0;
    const card = createMatchCard(match, color, isPrimary);
    resultsContainer.appendChild(card);
  });

  showState('results');
}

function createMatchCard(match, accentColor, isPrimary) {
  const matchDate = new Date(match.date);
  const card = document.createElement('div');
  card.className = isPrimary ? 'result-card' : 'result-card compact';

  const content = document.createElement('div');
  content.className = 'card-content';

  if (isPrimary) {
    content.innerHTML = buildPrimaryCardHTML(match, matchDate);
  } else {
    content.innerHTML = buildCompactCardHTML(match, matchDate);
  }

  card.appendChild(content);

  return card;
}

function buildPrimaryCardHTML(match, matchDate) {
  const time = formatTimeART(matchDate);
  const date = formatDateSpanish(matchDate);
  const relative = getRelativeDate(matchDate);
  const venue = match.venue || '';
  const city = match.city || '';

  let html = '';
  html += '<div class="card-competition">' + escapeHTML(match.competition) + '</div>';
  html += '<div class="card-teams">';
  html += '<span class="team-name home">' + escapeHTML(match.homeTeam.toUpperCase()) + '</span>';
  html += '<span class="vs-label">VS</span>';
  html += '<span class="team-name away">' + escapeHTML(match.awayTeam.toUpperCase()) + '</span>';
  html += '</div>';
  html += '<div class="card-divider"></div>';
  html += '<div class="card-time">' + escapeHTML(time) + '</div>';
  html += '<div class="card-date">' + escapeHTML(date) + '</div>';
  html += '<div class="card-relative">' + escapeHTML(relative) + '</div>';
  if (venue) {
    html += '<div class="card-divider"></div>';
    html += '<div class="card-venue">';
    html += '<div class="venue-name">' + escapeHTML(venue) + '</div>';
    if (city) {
      html += '<div class="venue-city">' + escapeHTML(city) + '</div>';
    }
    html += '</div>';
  }
  html += '<div class="card-source-icon">';
  html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">';
  html += '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>';
  html += '<line x1="12" y1="8" x2="12" y2="13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>';
  html += '<circle cx="12" cy="16.5" r="1" fill="currentColor"/>';
  html += '</svg>';
  html += '<div class="card-source-tooltip">FUENTE: ' + escapeHTML(match.source || 'ESPN') + '</div>';
  html += '</div>';

  return html;
}

function buildCompactCardHTML(match, matchDate) {
  const time = formatTimeART(matchDate);
  const date = formatDateSpanish(matchDate);
  const relative = getRelativeDate(matchDate);

  let html = '';
  html += '<div class="card-competition">' + escapeHTML(match.competition) + '</div>';
  html += '<div class="card-teams">';
  html += '<span class="team-name home">' + escapeHTML(match.homeTeam.toUpperCase()) + '</span>';
  html += '<span class="vs-label">VS</span>';
  html += '<span class="team-name away">' + escapeHTML(match.awayTeam.toUpperCase()) + '</span>';
  html += '</div>';
  html += '<div class="card-divider"></div>';
  html += '<div class="card-time-row">';
  html += '<div class="card-time">' + escapeHTML(time) + '</div>';
  html += '<div class="card-date">' + escapeHTML(date) + '</div>';
  html += '</div>';
  html += '<div class="card-relative">' + escapeHTML(relative) + '</div>';

  return html;
}

function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===========================
// Event Listeners
// ===========================

searchBtn.addEventListener('click', searchMatch);

teamInput.addEventListener('input', () => {
  showSuggestions(teamInput.value);
});

teamInput.addEventListener('focus', () => {
  showSuggestions(teamInput.value);
});

teamInput.addEventListener('blur', () => {
  setTimeout(() => hideSuggestions(), 150);
});

teamInput.addEventListener('keydown', (e) => {
  const items = suggestionsList.querySelectorAll('li');
  const isVisible = suggestionsList.classList.contains('visible');

  if (e.key === 'ArrowDown' && isVisible) {
    e.preventDefault();
    navigateSuggestions(1);
  } else if (e.key === 'ArrowUp' && isVisible) {
    e.preventDefault();
    navigateSuggestions(-1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (isVisible && activeSuggestionIndex >= 0 && activeSuggestionIndex < items.length) {
      const selectedText = items[activeSuggestionIndex].textContent;
      selectTeam(selectedText);
      searchMatch();
    } else {
      searchMatch();
    }
  } else if (e.key === 'Escape') {
    hideSuggestions();
  }
});

retryBtnError.addEventListener('click', () => {
  if (currentTeam) {
    teamInput.value = currentTeam;
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
