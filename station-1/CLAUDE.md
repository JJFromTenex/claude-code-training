# Station 1: Hook a Real Repo

## Code Style Rules

- Use semantic HTML elements (`<main>`, `<section>`, `<nav>`, `<article>`) — never bare `<div>` when a semantic tag fits
- No inline styles — all styling goes in `styles.css`
- All JavaScript functions must have a JSDoc comment explaining what they do
- Prefer `const` over `let`. Never use `var`
- No `console.log` statements in committed code — use proper error handling instead
- CSS class names use kebab-case: `.stat-card`, `.chart-bar`
- Keep functions under 25 lines. If it's longer, break it up.

## Project Context

This is a team metrics dashboard. It loads data from `data.json` and renders stat cards + a bar chart. The app has no build step — open `index.html` directly in a browser or use a local server.

## File Overview

- `index.html` — Main page structure
- `styles.css` — All styles
- `app.js` — Data fetching, rendering, and interactivity
- `data.json` — Mock team metrics data
