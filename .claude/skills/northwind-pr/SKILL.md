---
name: northwind-pr
description: Write a pull request description in Northwind's required format (What changed, How I verified it, Acceptance criteria, Deliberately not done) from the actual branch diff, log, and ticket. Use when the user asks to write or draft a PR description, or invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for the work on this branch, in Northwind's required format.

## What to do

### 1. Gather the facts before writing anything

- `git diff main...HEAD --stat` and then the full diff — what actually changed.
- `git log main..HEAD --oneline` — how the work was sequenced.
- The ticket in `docs/tickets/` — its acceptance criteria, verbatim.

Do not draft a single line of the description before you have all three.

### 2. Check each acceptance criterion honestly

Go criterion by criterion. Find the code that satisfies each one, or find that nothing does. If a criterion is half met, say half met and say which half — an unmet criterion reported honestly reads better than one left unmentioned, because a reviewer finds it either way.

### 3. Write the description

Title: `<TICKET-ID>: <what it does>`

- **What changed** — one plain-language paragraph. What can the app do now that it couldn't before? Not a file list — the diff already is one.
- **How I verified it** — the actual commands you ran and what they output. "Tests pass" is not evidence; "`npm test` — 12 passing, including the Luhn generator case" is. Say what you clicked and what appeared, if anything did.
- **Acceptance criteria** — the ticket's checkboxes, ticked honestly, with a note on any that are partial.
- **Deliberately not done** — anything out of scope or left for a follow-up. State it; don't bury it.

Every section, no placeholders left behind.

### 4. Print it

Print the finished description. Do not open a pull request, push a branch, or run any git command that changes state — this skill only writes the text.

## Rules

- **Never claim a verification step that was not actually run.** If you did not run a command, do not write that you ran it. If you did not click through something in a browser, do not say you did. This is the one rule that does not bend.
- **Plain language over ceremony.** "Ops can now issue a card and see it in the list" beats "implemented card issuance functionality."
- **Say what you did not do.** Stating a limit is not a weakness in a PR description; discovering it later is.
- **Keep it scannable.** Short paragraphs, real bullets. A reviewer skims first and reads second.
- **No emoji, no filler, no summary of the summary.**
