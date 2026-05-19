# Station 2: Live Data to Forecast

**Time:** 30 minutes | **Focus:** All roles | **Concepts:** Chained Skills

---

## What You'll Build

Two skills that chain together — one fetches data, one analyzes it — producing a shareable HTML dashboard with charts and projections. No coding experience required.

## Setup

```bash
cd station-2
```

Open Claude Code in this directory.

---

## Step 1: Build a Skill (10 min)

1. Look at the starter skill: `.claude/skills/fetch-data.md`
2. Run it: **"/fetch-data"**
3. Claude reads `data/market-data.json` and gives you a summary of 6 tickers over 30 days
4. Customize the skill — maybe add a filter for a specific ticker, or change the summary format

> **What you're learning:** Skills can read files and structure data. This is your first building block.

## Step 2: Chain a Second Skill (10 min)

1. Create a new skill: `.claude/skills/forecast.md`
2. Ask Claude: **"Create a /forecast skill that reads the market data, analyzes trends for each ticker, and produces a 7-day projection with confidence levels"**
3. Run it: **"/forecast"**
4. Claude analyzes the data and produces written projections

> **What you're learning:** Skills can build on each other. The first one fetches, the second one transforms. Composable building blocks.

## Step 3: Ship an Output (10 min)

1. Ask Claude: **"Run /fetch-data, then /forecast, and generate a forecast.html dashboard in the output/ folder with Chart.js charts showing actual data and projected trends"**
2. Open `output/forecast.html` in your browser
3. You now have a shareable, self-contained dashboard built entirely by Claude

> **What you're learning:** Claude can produce polished, shareable outputs. Skills + data + a clear prompt = a real deliverable.

---

## Stretch Goal

Replace the local JSON with a live API call. Get a free API key from [Alpha Vantage](https://www.alphavantage.co/support/#api-key) and update your `/fetch-data` skill to pull real stock data.

## Take-Home

- HTML forecast dashboard you can share
- Two reusable chained skills (`/fetch-data` + `/forecast`)

## Key Lesson

> Chaining skills — one fetches, one transforms. Composable building blocks you can reuse on any dataset.
