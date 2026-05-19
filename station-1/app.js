/**
 * Team Dashboard — loads data.json and renders stat cards, a revenue chart, and channel bars.
 */

/**
 * Formats a number with comma separators and optional prefix.
 * @param {number} num - The number to format
 * @param {string} prefix - Optional prefix like "$"
 * @returns {string} Formatted number string
 */
const formatNumber = (num, prefix = '') => {
  return prefix + num.toLocaleString('en-US');
};

/**
 * Calculates the percentage change between two values.
 * @param {number} current - Current period value
 * @param {number} previous - Previous period value
 * @returns {{ value: string, direction: string }} Change percentage and direction
 */
const calcChange = (current, previous) => {
  const pct = ((current - previous) / previous * 100).toFixed(1);
  return {
    value: `${pct > 0 ? '+' : ''}${pct}%`,
    direction: pct >= 0 ? 'up' : 'down'
  };
};

/**
 * Renders the three stat cards into the stats grid.
 * @param {object} summary - Summary data with revenue, active_users, support_tickets
 * @param {Array} trends - Weekly trend data for calculating changes
 */
const renderStats = (summary, trends) => {
  const grid = document.getElementById('stats-grid');
  const prev = trends[trends.length - 2];

  const cards = [
    { label: 'Revenue', value: formatNumber(summary.revenue, '$'), change: calcChange(summary.revenue, prev.revenue) },
    { label: 'Active Users', value: formatNumber(summary.active_users), change: calcChange(summary.active_users, prev.users) },
    { label: 'Support Tickets', value: summary.support_tickets, change: calcChange(summary.support_tickets, prev.tickets) }
  ];

  grid.innerHTML = cards.map(card => `
    <article class="stat-card">
      <div class="stat-label">${card.label}</div>
      <div class="stat-value">${card.value}</div>
      <div class="stat-change ${card.change.direction}">
        ${card.change.direction === 'up' ? '&#9650;' : '&#9660;'} ${card.change.value} vs last week
      </div>
    </article>
  `).join('');
};

/**
 * Renders a simple bar chart for weekly revenue.
 * @param {Array} trends - Weekly trend data with revenue figures
 */
const renderChart = (trends) => {
  const chart = document.getElementById('revenue-chart');
  const maxRevenue = Math.max(...trends.map(t => t.revenue));

  chart.innerHTML = trends.map(t => {
    const heightPct = (t.revenue / maxRevenue * 100).toFixed(0);
    return `
      <div class="chart-bar-wrapper">
        <div class="chart-value">${formatNumber(t.revenue, '$')}</div>
        <div class="chart-bar" style="height: ${heightPct}%"></div>
        <div class="chart-label">${t.week}</div>
      </div>
    `;
  }).join('');
};

/**
 * Renders horizontal bars for top acquisition channels.
 * @param {Array} channels - Channel data with name and value
 */
const renderChannels = (channels) => {
  const list = document.getElementById('channels-list');
  const maxVal = Math.max(...channels.map(c => c.value));

  list.innerHTML = channels.map(c => {
    const widthPct = (c.value / maxVal * 100).toFixed(0);
    return `
      <div class="channel-row">
        <span class="channel-name">${c.name}</span>
        <div class="channel-bar-track">
          <div class="channel-bar-fill" style="width: ${widthPct}%"></div>
        </div>
        <span class="channel-value">${formatNumber(c.value)}</span>
      </div>
    `;
  }).join('');
};

/**
 * Initializes the dashboard by fetching data and rendering all components.
 */
const init = async () => {
  try {
    const response = await fetch('data.json');
    const data = await response.json();

    renderStats(data.summary, data.weekly_trends);
    renderChart(data.weekly_trends);
    renderChannels(data.top_channels);
  } catch (error) {
    document.querySelector('.content').innerHTML = `
      <div style="padding: 40px; text-align: center; color: #ef4444;">
        <h2>Failed to load dashboard data</h2>
        <p>Make sure you're running a local server (e.g., <code>python3 -m http.server</code>)</p>
      </div>
    `;
  }
};

init();
