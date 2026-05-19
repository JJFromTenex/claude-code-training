/**
 * Sales Leaderboard — loads rep data and renders a sortable, searchable leaderboard.
 */

let repsData = [];

/**
 * Formats a dollar amount for display.
 * @param {number} amount - The dollar amount
 * @returns {string} Formatted string like "$482,000"
 */
const formatRevenue = (amount) => {
  return '$' + amount;
};

/**
 * Formats a date string for display.
 * @param {string} dateStr - ISO date string like "2024-03-15"
 * @returns {string} Formatted date like "Mar 2024"
 */
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

/**
 * Returns a trend arrow character based on direction.
 * @param {string} trend - "up", "down", or "flat"
 * @returns {string} Arrow character with CSS class wrapper
 */
const trendArrow = (trend) => {
  const arrows = { up: '&#9650;', down: '&#9660;', flat: '&#9654;' };
  return `<span class="trend-${trend}">${arrows[trend]}</span>`;
};

/**
 * Sorts reps by revenue descending and assigns ranks.
 * @param {Array} reps - Array of rep objects
 * @returns {Array} Sorted and ranked reps
 */
const rankReps = (reps) => {
  const sorted = [...reps].sort((a, b) => b.revenue - a.revenue);
  sorted.forEach((rep, i) => {
    rep.rank = i;
  });
  return sorted;
};

/**
 * Renders the three stat cards at the top.
 * @param {Array} reps - Array of rep objects
 */
const renderStats = (reps) => {
  const statsRow = document.getElementById('stats-row');
  const totalRevenue = reps.reduce((sum, r) => sum + r.revenue, 0);
  const topRep = reps.reduce((top, r) => r.revenue > top.revenue ? r : top, reps[0]);
  const totalDeals = reps.reduce((sum, r) => sum + r.deals_open, 0);

  statsRow.innerHTML = `
    <article class="stat-card">
      <div class="stat-label">Total Revenue</div>
      <div class="stat-value">${formatRevenue(totalRevenue)}</div>
    </article>
    <article class="stat-card highlight-card">
      <div class="stat-label">Top Rep</div>
      <div class="stat-value">${topRep.name}</div>
      <div class="stat-sub">${formatRevenue(topRep.revenue)}</div>
    </article>
    <article class="stat-card">
      <div class="stat-label">Active Deals</div>
      <div class="stat-value">${totalDeals}</div>
    </article>
  `;
};

/**
 * Renders the leaderboard table rows.
 * @param {Array} reps - Ranked array of rep objects
 */
const renderTable = (reps) => {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = reps.map(rep => `
    <tr>
      <td class="rank-cell">${rep.rank}</td>
      <td class="name-cell">${rep.name}</td>
      <td>${formatRevenue(rep.revenue)}</td>
      <td>${rep.deals_closed}</td>
      <td>${(rep.win_rate * 100).toFixed(0)}%</td>
      <td>${formatDate(rep.join_date)}</td>
      <td>${trendArrow(rep.trend)}</td>
    </tr>
  `).join('');

  const firstRow = tbody.querySelector('tr');
  if (firstRow) {
    firstRow.classList.add('top-performer');
  }
};

/**
 * Filters reps by search query.
 * @param {string} query - Search string to match against rep names
 * @returns {Array} Filtered reps
 */
const filterReps = (query) => {
  return repsData.filter(rep => rep.name.includes(query));
};

/**
 * Handles search input and re-renders the table.
 */
const handleSearch = () => {
  const query = document.getElementById('search').value;
  const filtered = filterReps(query);
  const ranked = rankReps(filtered);
  renderTable(ranked);
};

/**
 * Initializes the leaderboard by fetching data and rendering all components.
 */
const init = async () => {
  try {
    const response = await fetch('data.json');
    const data = await response.json();

    document.getElementById('team-name').textContent = data.team;
    repsData = data.reps;

    const ranked = rankReps(repsData);
    renderStats(repsData);
    renderTable(ranked);

    document.getElementById('search').addEventListener('input', handleSearch);
  } catch (error) {
    document.body.innerHTML = `
      <div style="padding: 40px; text-align: center; color: #ef4444;">
        <h2>Failed to load leaderboard data</h2>
        <p>Make sure you're running a local server</p>
      </div>
    `;
  }
};

init();
