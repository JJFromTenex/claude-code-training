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
- `docs/epics/` — where plans go before code does, and the template they follow
- `docs/ORG-STANDARDS.md` — the org-wide engineering standards every service is measured against. Ten numbered items; a reviewer cites them by number, so "violates #1" is what a finding against your pull request looks like
- `.claude/` — the skills (`/epic`, `/pr`, `/ship-ready`) and the `bug-investigator` subagent. Open Claude Code at this root and they are available everywhere
- `build-battle/` — the exercise brief and the scoring rubric
- `build-battle/merchant-console/` — Northwind Payments, the application itself
- `.github/` — pull request template and the grading workflow

## Commands

The application is in `build-battle/merchant-console/`, not at the repository
root. Run npm from the root with `--prefix`, or `cd` in first. Node 20+.

```bash
npm install --prefix build-battle/merchant-console   # no database, no seed step, no Docker
npm run dev     --prefix build-battle/merchant-console   # http://localhost:3000
npm test        --prefix build-battle/merchant-console   # Vitest — 28 tests, about a second
npm run lint    --prefix build-battle/merchant-console
npm run build   --prefix build-battle/merchant-console
```

A single test file, or a single case, from inside `build-battle/merchant-console`:

```bash
npm test -- src/lib/csv.test.ts
npm test -- -t "quotes cells containing a comma"
```

Vitest collects only `src/**/*.test.ts` and runs in a node environment with no
jsdom. Everything under test is money math, date bucketing, and serialization,
none of which needs a DOM — which is what keeps the suite fast enough to run
before every push.

`.claude/launch.json` already defines a `merchant-console` dev-server config on
port 3000, so the app can be launched and previewed without composing the
command by hand.

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

The grading workflow fires on open, reopen, push, and ready-for-review, so every
push to an open pull request re-scores it and your best run counts. Draft pull
requests are skipped until you mark them ready.

## Release Standards

- **Test evidence before merge.** Every change carries proof it works — the command that was run and what it reported. An intention to test is not evidence.
- **No direct commits to `main`.** Work lands on a ticket branch and merges through a pull request, without exception.
- **Every pull request states its business impact in one line.** What changes for the people using this, in plain language.
