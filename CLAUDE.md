# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Training repository for the Repo Rescue workshop. Learners take a ticket end to end against the Northwind Payments merchant console, then open a pull request here to be scored.

Context in this repo is layered on purpose, and the layering is part of what the workshop teaches:

| File | Scope | What belongs in it |
| --- | --- | --- |
| `CLAUDE.md` (this file) | Every session | What the repo is, where things live, how work is submitted |
| `build-battle/CLAUDE.md` | The exercise | The ticket, the order of operations, what is preloaded |
| `build-battle/merchant-console/CLAUDE.md` | The application | Codebase conventions and card rules |
| `build-battle/merchant-console/.claude/rules/*.md` | Matching files only | Detail that would be noise until you open that kind of file |

Read the narrowest one that applies before you write code.

## Tech stack

The merchant console (`build-battle/merchant-console/`) is built with:

- **Next.js 16** (App Router) / **React 19** / **TypeScript** (strict)
- **Tailwind CSS** — no inline styles, no CSS modules
- **Tremor + Radix UI** — the component library in `src/components/`
- **Vitest** — node environment, no DOM
- **In-memory data store** — JSON seed data, no database, no ORM

Path alias: `@/*` maps to `src/*` (e.g., `import { store } from "@/data/store"`).

## Commands

All commands run from `build-battle/merchant-console/`:

```bash
npm install          # install dependencies (requires Node 20+)
npm run dev          # start dev server at localhost:3000
npm run build        # production build
npm run lint         # ESLint via next lint
npm test             # vitest run (all tests, <1 second)
npm run test:watch   # vitest in watch mode
```

Run a single test file:
```bash
npx vitest run src/lib/money.test.ts
```

Tests cover `src/lib/` helpers only (money, dates, CSV). There are no component or E2E tests.

## Repository layout

- `docs/tickets/` — the tickets engineers work, written as they arrive on a sprint board
- `docs/epics/` — where plans go before code does, and the template they follow
- `docs/ORG-STANDARDS.md` — the org-wide engineering standards every service is measured against; the grader checks these
- `.claude/` — the skills (`/epic`, `/pr`, `/ship-ready`) and the `bug-investigator` subagent. Open Claude Code at this root and they are available everywhere
- `build-battle/` — the exercise brief and the scoring rubric
- `build-battle/merchant-console/` — Northwind Payments, the application itself
- `.github/` — pull request template and the grading workflow

## Architecture

- `/` redirects to `/overview`. Existing routes: overview, payments, disputes, payouts. Cards does not exist yet (NWP-201).
- Route handlers live in `src/app/api/`. The query builder behind `GET /api/payments` is the one to reuse for filtering.
- Seed data (`src/data/*.json`) loads into `src/data/store.ts` at boot. Writes last for the dev server lifetime.
- Shared helpers in `src/lib/`: `money.ts` (formatting minor units), `dates.ts` (UTC bucketing), `csv.ts` (export serialization). Each has a co-located `.test.ts`. Read these before touching amounts or dates.

## Conventions

- Plan before you build. `/epic` turns a ticket into a written plan that cites real files; it is scored.
- Read before you edit. A second implementation of an existing helper is a defect, not a shortcut.
- Never edit seed data to make a failing case disappear.
- Nothing in this repository may resemble real payment data. Generated card numbers use the `4242` test BIN.

## Submissions

Work is submitted as a pull request against this repository and scored automatically.

- Branch from `main` with the ticket ID: `NWP-201-issue-cards`
- Commit subjects carry the ticket ID: `NWP-201: issue virtual cards`
- Fill in the pull request template. The grader reads it.
- Run `npm test` and `/ship-ready` before pushing.

## Release standards

- All changes require test evidence (passing test output or manual verification steps) before merging.
- No direct commits to `main`. All work goes through a pull request.
- Every PR must include a one-line business impact summary explaining why the change matters.
