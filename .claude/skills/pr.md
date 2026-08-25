---
name: pr
description: Write the pull request description for the work on the current branch, from the diff, the ticket, and the epic. Use once a ticket's implementation is done and ready to submit.
---

# /pr

Write the pull request description for the work in this branch.

The reviewer reads this before it reads your diff, and it is worth 10% of your Build Battle score on its own. It takes ninety seconds and it is the cheapest points on the board.

## What to do

### 1. Gather the facts. Do not guess at them.

- `git diff main...HEAD --stat` and then the diff itself — what actually changed
- `git log main..HEAD --oneline` — how it was sequenced
- The ticket in `docs/tickets/` — the acceptance criteria, verbatim
- The epic in `docs/epics/`, if one exists — what was planned, and where the build departed from it

### 2. Check each acceptance criterion honestly

Go criterion by criterion. For each one, find the code that satisfies it, or find that nothing does.

Do not mark a criterion met because you intended to meet it. If it is half done, say half done and say which half. **An unmet criterion reported honestly scores better than an unmet criterion left unmentioned**, because the reviewer will find it either way and one of those looks like a mistake while the other looks like a lie.

### 3. Fill in the template

Use `.github/pull_request_template.md`. Every section, no placeholders left behind.

- **Ticket** — the ID, so it links.
- **What changed** — one short paragraph in plain language. What can the app do now that it could not do before? Not a file list; the diff already is one.
- **How I verified it** — the commands you ran and what you saw. "Tests pass" is weak. "`npm test` — 12 passing, including the Luhn generator case" is evidence. Name what you clicked and what appeared.
- **Acceptance criteria** — the checkboxes from the ticket, ticked truthfully, with a note on any that are partial.
- **Bugs fixed along the way** — anything found beyond the ticket. Name the file and the root cause, not the symptom.
- **Notes for the reviewer** — trade-offs, what you left out and why, anything you would say out loud in a review.

### 4. Offer to open it

Print the finished description. Then offer to open the PR:

```bash
gh pr create --title "<TICKET-ID>: <what it does>" --body-file <file>
```

Ask before running it. Opening a pull request is the user's call, not yours.

## Rules

- **Plain language over ceremony.** "Ops can now issue a card and see it in the list" beats "implemented card issuance functionality".
- **No invented verification.** If you did not run it, do not write that you ran it. This is the fastest way to lose a reviewer's trust and the grader checks it.
- **Say what you did not do.** Unfinished stretch goals, known rough edges, the test you meant to write. Stating a limit is not a weakness in a PR; discovering it is.
- **Keep it scannable.** Short paragraphs, real bullets. A reviewer skims first and reads second.
- **No emoji, no filler, no summary of the summary.**

## Why this exists

A good description is not paperwork. It is the difference between a reviewer who understands your change in thirty seconds and one who reverse-engineers it from a diff and guesses at your intent. On this ticket it is also directly scored — but the habit is the point, and it outlives the workshop.
