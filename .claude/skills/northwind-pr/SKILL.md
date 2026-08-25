---
name: northwind-pr
description: Write a pull request description in the Northwind team's required format (Title, What changed, How I verified it, Acceptance criteria, Deliberately not done). Use when the user asks to write, draft, or fill in a PR description for this repo, or invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for the work in this branch, in the team's required format.

The reviewer reads this before it reads your diff. It exists so they understand the change in thirty seconds instead of reverse-engineering it from a diff.

## What to do

### 1. Gather the facts. Do not guess at them.

- `git diff main...HEAD --stat` and then the diff itself — what actually changed
- `git log main..HEAD --oneline` — how it was sequenced
- The ticket in `docs/tickets/` — the acceptance criteria, verbatim

Read all three before writing a single line of the description.

### 2. Check each acceptance criterion honestly

Go criterion by criterion. For each one, find the code that satisfies it, or find that nothing does.

Do not mark a criterion met because you intended to meet it. If it is half done, say half done and say which half. An unmet criterion reported honestly scores better than an unmet criterion left unmentioned, because the reviewer will find it either way and one of those looks like a mistake while the other looks like a lie.

### 3. Write the description in this exact format

- **Title** — `<TICKET-ID>: <what it does>`
- **What changed** — one short paragraph in plain language. What can the app do now that it could not do before? Not a file list; the diff already is one.
- **How I verified it** — the actual commands you ran and what they actually output. "Tests pass" is not evidence. "`npm test` — 12 passing, including the Luhn generator case" is evidence. If a step was never run, it does not appear here.
- **Acceptance criteria** — the ticket's checkboxes, ticked honestly, with a note on any that are partial.
- **Deliberately not done** — anything out of scope, skipped, or left for a follow-up. Name it plainly; a stated limit is not a weakness in a PR, discovering one during review is.

### 4. Offer to open it

Print the finished description. Then offer to open the PR:

```bash
gh pr create --title "<TICKET-ID>: <what it does>" --body "<description>"
```

Ask before running it. Opening a pull request is the user's call, not yours.

## Rules

- **Read the diff, the log, and the ticket before writing anything.** Do not draft from memory of the conversation — verify against the actual git state and the ticket file.
- **Never claim a verification step that was not actually run.** If you did not run a command, do not write that you ran it, and do not report output you did not see. This is the fastest way to lose a reviewer's trust.
- **Plain language over ceremony.** "Ops can now issue a card and see it in the list" beats "implemented card issuance functionality".
- **Say what you did not do.** Every out-of-scope item, rough edge, or skipped test belongs in "Deliberately not done," not silently omitted.
- **Keep it scannable.** Short paragraphs, real bullets. No emoji, no filler, no summary of the summary.
