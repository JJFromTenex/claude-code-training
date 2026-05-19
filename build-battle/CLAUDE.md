# Build Battle: Sales Leaderboard

## Code Style Rules

- Use semantic HTML elements
- Keep functions under 30 lines — if it's longer, break it up
- All user-facing numbers must be formatted with commas (e.g., $1,234,567)
- Sort operations must be stable (preserve original order for equal values)
- No `console.log` in committed code
- Prefer `const` over `let`. Never use `var`
- All functions need JSDoc comments

## Project Context

This is a sales leaderboard dashboard. It loads rep data from `data.json` and renders a leaderboard table with stat cards and a search bar.

**Known issue:** There's an open GitHub Issue describing a feature to build. Check the Issues tab.

## File Overview

- `index.html` — Page structure
- `styles.css` — All styles
- `app.js` — Data loading, rendering, sorting, searching
- `data.json` — Sales rep data
