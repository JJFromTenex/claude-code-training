# Build Battle PR Grader

You are scoring a workshop Build Battle submission. Participants were given a sales leaderboard app with 6 hidden bugs and asked to fix them + build a new feature. Score fairly on a 0.00–1.00 scale.

## Original Source (before any changes)

### app.js (original)
```js
let repsData = [];

const formatRevenue = (amount) => {
  return '$' + amount;
};

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
};

const trendArrow = (trend) => {
  const arrows = { up: '&#9650;', down: '&#9660;', flat: '&#9654;' };
  return `<span class="trend-${trend}">${arrows[trend]}</span>`;
};

const rankReps = (reps) => {
  const sorted = [...reps].sort((a, b) => b.revenue - a.revenue);
  sorted.forEach((rep, i) => {
    rep.rank = i;
  });
  return sorted;
};

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
  if (firstRow) firstRow.classList.add('top-performer');
};

const filterReps = (query) => {
  return repsData.filter(rep => rep.name.includes(query));
};

const handleSearch = () => {
  const query = document.getElementById('search').value;
  const filtered = filterReps(query);
  const ranked = rankReps(filtered);
  renderTable(ranked);
};

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
```

### data.json — Nina Patel's entry (the bug)
```json
{ "name": "Nina Patel", "revenue": 298000, "deals_closed": 11, "deals_open": 7, "win_rate": 0.73, "join_date": "2025-14-01", "trend": "down" }
```

### styles.css — note: `.top-performer` is NOT defined (the bug)

## The 6 Bugs

| # | Bug | Location | What's wrong | Valid fix |
|---|-----|----------|-------------|-----------|
| 1 | Off-by-one ranking | `rankReps`: `rep.rank = i` | Rank starts at 0 | Change to `i + 1` |
| 2 | No comma formatting | `formatRevenue`: `'$' + amount` | Shows "$482000" | Use `toLocaleString()` or equivalent |
| 3 | Unstable sort | `rankReps`: sort comparator | No tiebreaker for equal revenue | Add secondary sort key (e.g. name) |
| 4 | Missing CSS class | `renderTable` adds `.top-performer` | Class not in styles.css | Add `.top-performer` rule to CSS |
| 5 | Invalid date | `data.json`: Nina Patel `"2025-14-01"` | Month 14 → NaN | Fix date or add error handling in `formatDate` |
| 6 | Case-sensitive search | `filterReps`: `.includes(query)` | "sarah" won't find "Sarah" | Lowercase both sides |

## Feature Spec: Time-Period Filter

Requirements:
1. **UI** — Dropdown or button group: This Week / This Month / This Quarter / All Time
2. **Leaderboard** — Re-sorts using `period_revenue.week`, `.month`, `.quarter`, or base `revenue`
3. **Stat cards** — Total Revenue and Top Rep update for selected period
4. **URL hash** — Selected filter stored in hash (`#week`, `#month`, etc.) and restored on load
5. **Default** — All Time, unless hash says otherwise

Score: 1.0 = all 5 met · 0.5–0.9 = works but missing hash or stat updates · 0.1–0.4 = partial attempt · 0.0 = not implemented

## Code Quality Checks

- Functions under 30 lines, const over let, JSDoc on all functions
- Numbers formatted with commas, stable sort
- No console.log, no TODO/FIXME, no inline styles
- No new bugs introduced
- Semantic HTML, accessible (labels, alt text, heading levels)

## Scoring

| Category | Weight |
|----------|--------|
| Feature | 40% |
| Bugs Fixed | 30% (each bug = 5%) |
| Code Quality | 20% |
| PR Description | 10% |

**Formula:** (Feature × 0.40) + (Bugs × 0.30) + (Quality × 0.20) + (Description × 0.10)

## Output Format

```
## 🏆 Build Battle Score: X.XX / 1.00

### Feature: Time-Period Filter — X.XX / 1.00 (40%)
[2-3 sentences on what works and what's missing]

### Bugs Fixed: X/6 — X.XX / 1.00 (30%)
- Bug 1 (Off-by-one ranking): ✅ FIXED / ❌ NOT FIXED — [one line]
- Bug 2 (Revenue formatting): ✅ FIXED / ❌ NOT FIXED — [one line]
- Bug 3 (Unstable sort): ✅ FIXED / ❌ NOT FIXED — [one line]
- Bug 4 (Missing CSS class): ✅ FIXED / ❌ NOT FIXED — [one line]
- Bug 5 (Invalid date): ✅ FIXED / ❌ NOT FIXED — [one line]
- Bug 6 (Case-sensitive search): ✅ FIXED / ❌ NOT FIXED — [one line]

### Code Quality — X.XX / 1.00 (20%)
[2-3 sentences]

### PR Description — X.XX / 1.00 (10%)
[1-2 sentences]

---
**Breakdown:** Feature (X.XX × 0.40) + Bugs (X.XX × 0.30) + Quality (X.XX × 0.20) + PR (X.XX × 0.10) = **X.XX**
```

Be fair. Give credit for partial fixes. Do not give credit for changes that don't actually fix the underlying issue. If the diff is truncated, note it but score what you can see.
