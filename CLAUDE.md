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
- `docs/ORG-STANDARDS.md` — the org-wide engineering standards every service is measured against
- `.claude/` — the skills (`/epic`, `/pr`, `/ship-ready`) and the `bug-investigator` subagent. Open Claude Code at this root and they are available everywhere
- `build-battle/` — the exercise brief and the scoring rubric
- `build-battle/merchant-console/` — Northwind Payments, the application itself
- `build-battle/merchant-console/.claude/rules/` — `money.md`, `api-routes.md`, `cards.md`, `components.md`. Each carries `paths:` frontmatter and loads automatically when you open a matching file, so read the file you are editing rather than all four up front
- `.github/` — pull request template and the grading workflow

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

## Release Standards

- Every change carries test evidence before it merges. Paste the run — command and result — into the pull request; a claim that it passes is not evidence.
- No direct commits to `main`. Branch, open a pull request, merge from there.
- Every pull request includes a one-line business impact summary: what changes for merchants or the business if this ships.
