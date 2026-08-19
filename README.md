# Claude Code Training

**Repo Rescue** — a hands-on workshop where you take a real ticket through a real codebase with Claude Code, open a pull request, and get scored on it.

Built by [Tenex](https://tenex.co) in partnership with Anthropic.

> **Status:** the Northwind merchant console is mid-build. The base app and the tickets are in place; the API, seed data, and planted bugs are still landing.

---

## The premise

You are a new engineer at **Northwind Payments**, a fictional payments company. Your team owns the merchant console: the internal tool support and ops staff use to look up a payment, refund it, and work the dispute queue.

It is your first sprint. NWP-101 is assigned to you. NWP-102 is sitting in triage, unloved, and three merchants are asking about it.

Every merchant, cardholder, and amount in this repository is generated. Northwind Payments is not a real company.

## Prerequisites

- [ ] **Claude Code** installed and authenticated
- [ ] **GitHub account**, for submitting your pull request
- [ ] **Git** installed
- [ ] **Node.js 20+**
- [ ] A code editor — optional

## Quick Start

```bash
git clone https://github.com/JJFromTenex/claude-code-training.git
cd claude-code-training/build-battle/merchant-console
npm install
npm run dev
```

No database and no seed step. Data lives in memory and resets when you restart the dev server.

Then read your ticket, and pull it into Claude Code rather than retyping it:

```
@docs/tickets/NWP-201.md
```

Then build the context before you build the feature:

```
/epic docs/tickets/NWP-201.md
```

## How this repo is used

It is both where you get the work and where you hand it in.

1. **Download.** Clone this repository, or fork it if you want somewhere of your own to push.
2. **Take your ticket.** `docs/tickets/` holds tickets written the way they arrive on a sprint board: description, acceptance criteria, notes from the team, and an explicit out-of-scope list.
3. **Build the context.** `/epic` turns the ticket into a plan that cites real files. This is the habit the workshop is teaching, and it is worth 10% of your Build Battle score.
4. **Do the work.** Branch with the ticket ID, for example `NWP-201-issue-cards`.
5. **Open a pull request** against this repository. The template asks what changed and how you verified it.
6. **Get scored.** A Claude reviewer runs on every push to an open PR and comments with a breakdown. Push again and it re-scores. Your best run counts.

## Layout

| Path | What it is |
|------|-----------|
| `docs/tickets/` | The tickets you work |
| `docs/epics/` | Where your plans go, and the template they follow |
| `build-battle/` | The exercise brief, scoring, and the skills and subagent you get |
| `build-battle/merchant-console/` | Northwind Payments, the application itself |
| `.github/` | PR template and the grading workflow |

## The tickets

| Ticket | What it is | Where it is used |
|--------|-----------|-----------------|
| [NWP-201](docs/tickets/NWP-201.md) | Issue virtual cards from the console | **Build Battle**, 40 minutes, graded |
| [NWP-101](docs/tickets/NWP-101.md) | Payments export options | Guided practice, 10–15 minutes |
| [NWP-102](docs/tickets/NWP-102.md) | Merchants say yesterday's totals are wrong | Investigation exercise |
| [Backlog](docs/tickets/BACKLOG.md) | Referenced but not scheduled | Do not build these |

## What comes preloaded

Run Claude Code from `build-battle/` and you get:

| | What it does |
|---|---|
| `/epic` | Turns a ticket into a plan that cites real files. Run it before you build |
| `/pr` | Writes the pull request description from your branch, the ticket, and the epic |
| `/ship-ready` | Pre-push check: money math, UTC handling, duplicate logic, unvalidated input |
| `bug-investigator` | A read-only subagent that diagnoses a bug report and returns a written root-cause analysis. It cannot edit anything, which is the point |

No hooks are preinstalled. Adding one is a good use of your time if you finish early — a `PreToolUse` hook that blocks a push when tests fail is the obvious one.

## Concepts you will use

| Concept | What It Is | Where You Use It |
|---------|-----------|-----------------|
| **CLAUDE.md** | Persistent project context that loads every session | Before you write a line |
| **Skills** | Reusable slash commands in `.claude/skills/` | `/epic`, then `/ship-ready`, then `/pr` |
| **Plan mode** | Claude proposes an approach before it edits | Right after the epic |
| **Sub-Agents** | Independent Claude instances with their own context and permissions | `bug-investigator` on NWP-102 |
| **Hooks** | Shell commands that fire before or after Claude acts | Yours to add |
| **MCP Connectors** | Connect Claude to external tools | Driving the browser to verify your work |

<!-- grader smoke test: pipeline check, close without merging -->
<!-- second push: upsert check -->
