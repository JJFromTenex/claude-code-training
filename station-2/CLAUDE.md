# Station 2: Live Data to Forecast

## Rules

- Always cite the data source when presenting numbers (e.g., "Source: market-data.json, 30-day window")
- Use Chart.js via CDN for any visualizations: `https://cdn.jsdelivr.net/npm/chart.js`
- All HTML output must be self-contained — inline CSS and JS, no external files. A single .html file someone can open in any browser.
- Include a "Data as of: [timestamp]" line in every generated report or dashboard
- Numbers must be formatted with commas and appropriate currency symbols
- When analyzing trends, always state the time period and sample size

## Project Context

This station teaches skill chaining. Attendees build two skills that work together:
1. `/fetch-data` — reads market data and summarizes it
2. `/forecast` — takes the summary and produces projections

The final output is `output/forecast.html` — a shareable dashboard with charts.

## File Overview

- `data/market-data.json` — 30 days of stock/market data for 6 tickers
- `.claude/skills/fetch-data.md` — Starter skill for reading and summarizing data
- `output/` — Where generated HTML dashboards should be saved
