---
name: epic
description: Turn a ticket into an epic — a written, reviewable plan that cites real files and becomes the context for the build. Use before writing any code for a ticket in this repo.
---

# /epic

Turn a ticket into an epic: a written, reviewable plan that becomes the context for the build.

Use this **before** writing code. A ticket says what someone wants. An epic says what is actually there, what you are going to do about it, and how you will know it worked. Writing it takes a few minutes and it is the difference between Claude building the right thing and Claude building something plausible.

## Usage

```
/epic docs/tickets/NWP-201.md
```

If no ticket is given, ask which one.

## What to do

### 1. Read the ticket, and read the code

Read the ticket in full, including anything marked out of scope. Then go find out what is actually true in this repository. Do not guess and do not assume the ticket is accurate about the codebase.

Look for, and note the file and line of, each of these:

- Where similar data already flows: the route handler, the store, the types.
- Helpers that already exist for money, dates, formatting, and validation. Using them is the job; rewriting them loses points.
- The conventions in `CLAUDE.md` that apply to this ticket, quoted, not paraphrased.
- Anything in the ticket that contradicts the code. Say so plainly.

### 2. Ask before you assume

Ask the user about anything that genuinely changes the shape of the work. One question at a time, with a recommendation. Do not ask about things the ticket or the code already answers.

Good questions: an ambiguous state transition, an unclear limit, whether an edge case is in scope.
Bad questions: what colour the button should be.

### 3. Write the epic

Write it to `docs/epics/<ticket-id>-<slug>.md` using the template in `docs/epics/TEMPLATE.md`. The slug is the ticket's branch name with the ticket id removed, so the epic and the branch line up: NWP-101 ships on `NWP-101-export-options`, so its epic is `docs/epics/NWP-101-export-options.md`. If the ticket names no branch, use two or three words from its title. Tell the engineer the exact path you wrote, because they will `@`-mention it next.

Fill in every section:

- **Problem** — who is stuck and what it costs them, in their words, from the ticket.
- **Current state** — what the code does today, with file paths. This is the section that earns its keep.
- **Domain rules** — the constraints that must hold, quoted from `CLAUDE.md` and the ticket. Money units, masking, state machine, validation.
- **Approach** — the shape of the change in a paragraph, and the alternative you rejected with the reason.
- **File map** — every file you expect to add or change, one line each on why.
- **Plan** — sequenced steps, each one small enough to verify before the next begins.
- **Verification** — how each acceptance criterion gets proven. Name the test, the command, or the thing you will click.
- **Risks and out of scope** — what could go wrong, and what you are deliberately not doing.

### 4. Hand it back

Print a short summary and tell the user to review it before building. Then say this, plainly:

> Load the epic as context before implementing: `@docs/epics/<file>.md`

## Rules

- **No code in the epic.** File paths and function names, yes. Implementations, no. If you are writing the solution, you are past the point of this document.
- **Every claim about the codebase carries a path.** "Payments are filtered in `src/app/api/payments/route.ts`" beats "there is a payments API".
- **Sequence for verification, not for tidiness.** Each step should end somewhere you can check the result.
- **Keep it under two pages.** An epic nobody reads is worth nothing, and a long one is usually a sign the ticket needs splitting.
- **Say what you do not know.** An honest open question is more useful than a confident guess.

## Why this exists

Everything you write here goes into context and stays there. Claude stops rediscovering the codebase every few turns, stops inventing helpers that already exist, and stops drifting from the acceptance criteria. You get to review the plan while it is cheap to change, instead of reviewing a diff when it is expensive.

This is the habit the workshop is actually teaching. The feature is just the excuse.
