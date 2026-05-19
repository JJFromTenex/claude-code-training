# Claude Code Workshop

**3 hours. 3 stations. 1 Build Battle.**

A hands-on workshop where every attendee ships something real using Claude Code. Built by [Tenex](https://tenex.co) in partnership with Anthropic.

---

## Prerequisites

- [ ] **Claude Code** installed and authenticated (`claude` command works in your terminal)
- [ ] **GitHub account** (for Build Battle PR submissions)
- [ ] **Git** installed
- [ ] A code editor (VS Code, Cursor, etc.) — optional, Claude Code runs in the terminal
- [ ] Node.js 18+ — optional, only if you want a local dev server

## Quick Start

```bash
git clone https://github.com/tenex-workshop/claude-code-workshop.git
cd claude-code-workshop
```

Then follow the station instructions in order.

---

## Workshop Schedule

| Time | Block | What You Do |
|------|-------|-------------|
| 0:00–0:05 | **The Hook** | Connect Claude to Slack/Teams, ask it a real question |
| 0:05–0:30 | **Foundation** | Watch demos of CLAUDE.md, Skills, MCP, Hooks, Sub-Agents |
| 0:30–1:00 | **Station 1** | `cd station-1` — Hook a real repo (engineering) |
| 1:00–1:30 | **Station 2** | `cd station-2` — Live data to forecast (analytics) |
| 1:30–1:45 | **Break** | |
| 1:45–2:15 | **Station 3** | `cd station-3` — Pipeline to outreach (sales/GTM) |
| 2:15–2:45 | **Build Battle** | `cd build-battle` — Fork, fix, build, get scored |
| 2:45–3:00 | **Close** | Leaderboard reveal + wrap-up |

## Stations

### Station 1: Hook a Real Repo
**Engineering-focused** — CLAUDE.md, Skills, Hooks

Clone a dashboard app, explore its CLAUDE.md, build a skill, wire a hook. Take home a hooked repo with a reusable `/ship-ready` skill.

### Station 2: Live Data to Forecast
**All roles** — Chained Skills

Build a `/fetch-data` skill, chain a `/forecast` skill on top, ship an HTML dashboard. Take home two composable skills and a shareable forecast.

### Station 3: Pipeline to Outreach
**Sales & GTM** — MCP Connectors + Skills

Load a CRM pipeline, analyze your writing voice, build a `/outreach` skill that drafts personalized follow-ups. Take home an outreach workflow trained on your style.

### Build Battle: Sales Leaderboard
**Everyone competes** — Everything from the day

Fork a buggy sales leaderboard. Find the planted bugs. Build the requested feature. Push a PR. A Claude sub-agent scores every submission live.

---

## Foundation Concepts Reference

| Concept | What It Is | Where You Use It |
|---------|-----------|-----------------|
| **CLAUDE.md** | Persistent project context that loads every session | Station 1, all stations |
| **Skills** | Reusable slash commands (SKILL.md in `.claude/skills/`) | Station 1, 2, 3 |
| **MCP Connectors** | Connect Claude to external tools (Slack, Gmail, Jira) | Station 3 |
| **Hooks** | Shell commands that fire before/after Claude acts | Station 1 |
| **Sub-Agents** | Independent Claude instances for delegated tasks | Build Battle |
