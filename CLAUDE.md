# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Code Training — Repo Rescue

Training repository for the Repo Rescue workshop. Learners take a ticket end to end against the Northwind Payments merchant console, then open a pull request here to be scored.

Context in this repo is layered on purpose, and the layering is part of what the workshop teaches:

| File | Scope | What belongs in it |
| --- | --- | --- |
| `CLAUDE.md` (this file) | Every session | What the repo is, where things live, how work is submitted |
| `build-battle/CLAUDE.md` | The exercise | The ticket, the order of operations, what is preloaded |
| `build-battle/merchant-console/CLAUDE.md` | The application | Codebase conventions and card rules |
| `build-battle/merchant-console/.claude/rules/*.md` | Matching files only | Detail that would be noise until you open that kind of file |

Read the narrowest one that applies before you write code.

## Repository layout

- `docs/tickets/` — the tickets engineers work, written as they arrive on a sprint board
- `docs/specs/` — where plans go before code does, and the template they follow
- `docs/ORG-STANDARDS.md` — the org-wide engineering standards every service is measured against
- `.claude/` — the skills (`/spec`, `/pr`, `/ship-ready`, `/submit`) and the `bug-investigator` subagent. Open Claude Code at this root and they are available everywhere
- `build-battle/` — the exercise brief and the scoring rubric
- `build-battle/merchant-console/` — Northwind Payments, the application itself
- `.github/` — pull request template and the grading workflow

## Commands

All of these run from `build-battle/merchant-console/`. Node 20+.

```bash
npm install                      # first time only
npm run dev                      # http://localhost:3000, redirects to /overview
npm test                         # vitest, node environment, under a second
npx vitest run src/lib/csv.test.ts   # a single test file
npm run lint                     # next lint
npm run build                    # production build, catches type errors
```

Tests live beside the helper they cover (`src/lib/*.test.ts`) and only match that pattern. Extend the existing file rather than adding a new one.

## How the app fits together

Detail lives in `build-battle/merchant-console/CLAUDE.md`. The shape you need before opening files:

- **Data** is generated at boot in `src/data/generate.ts` and held on `globalThis` by `src/data/store.ts` so Next.js hot reload does not reset it. Route handlers and server components read the store directly; there is no fetch layer between them.
- **Every payment read goes through `src/data/queries.ts`.** `parseFilters` allowlists client params, `filterPayments` and `sortPayments` do the work, `paginate` slices 20 rows. `queryPayments` composes all three for the table; the CSV export calls the first two and skips pagination on purpose.
- **Pages are server components** that read `searchParams` and call the query builder. Client components are small islands (the payments filter bar, chart controls) that only push URL state via the router.
- **Money formatting happens in two places only:** `src/lib/money.ts` helpers, called from the component that renders the value or from `src/lib/csv.ts` at export time. Everything upstream is integer minor units with a currency code.
- **UI primitives** in `src/components/` are Tremor on Radix. Dialog, Select, Input, Button, Table, Badge already exist; console-specific pieces are under `src/components/ui/`.

## Conventions

- Plan before you build. `/spec` turns a ticket into a written plan that cites real files; it is scored.
- Read before you edit. A second implementation of an existing helper is a defect, not a shortcut.
- Never edit seed data to make a failing case disappear.
- Nothing in this repository may resemble real payment data. Generated card numbers use the `4242` test BIN.

## Release Standards

- All changes need test evidence before merging. Paste the test summary in the PR; a green run is the proof, not a promise.
- No direct commits to `main`. Every change arrives through a pull request from a ticket branch.
- Every PR must include a one-line business impact summary: who benefits and how, in one sentence.

## Submissions

Work is submitted as a pull request against this repository and scored automatically.

- Branch from `main` with the ticket ID: `NWP-201-issue-cards`
- Commit subjects carry the ticket ID: `NWP-201: issue virtual cards`
- Fill in the pull request template. The grader reads it.
