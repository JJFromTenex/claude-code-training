# Station 3: Pipeline to Outreach

## Rules

- Outreach emails must be under 150 words
- Never use these phrases: "hope this finds you well", "just checking in", "touching base", "circling back"
- Always reference specific deal context from the pipeline data — generic outreach is not acceptable
- Match the tone and style of the sample emails in `data/sample-emails/`
- When analyzing pipeline data, flag any deal with 30+ days since last touch as "stalled"
- Output files go in the `output/` directory as markdown (.md) or CSV (.csv)

## Project Context

This station teaches MCP connectors + Skills working together. Attendees:
1. Load a CRM pipeline from `data/pipeline.csv`
2. Analyze their writing voice from sample emails (or Gmail MCP if configured)
3. Build a `/outreach` skill that drafts personalized follow-ups

## File Overview

- `data/pipeline.csv` — 20 fictional accounts with deal stages and notes
- `data/sample-emails/` — 12 sample sent emails showing a consistent writing voice
- `.claude/skills/outreach.md` — Starter outreach skill
- `output/` — Where generated outreach drafts land
