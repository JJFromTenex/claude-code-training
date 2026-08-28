---
name: northwind-pr
description: Write a pull request description in Marcus's required format — ticket ID in the title, what changed in plain language, how it was verified with the real commands and their output, the ticket's acceptance criteria ticked honestly, and what was deliberately left out. Use when the user asks for a PR description for a branch, or invokes /northwind-pr, optionally with a branch name.
---

# /northwind-pr

Write the pull request description for a branch, in the format Marcus bounces PRs for not following.

Usage: `/northwind-pr` for the current branch, or `/northwind-pr <branch>` for another one. Worktrees share one repository, so any branch in `git branch --list` is reachable from here.

## What to do

### 1. Gather the facts before writing a word

Run these and read the output. Do not write from memory of the branch.

- `git log main..<branch> --oneline` — the commits, and the ticket ID from their subjects
- `git diff main...<branch> --stat`, then `git diff main...<branch>` — what actually changed
- The ticket: `docs/tickets/<TICKET-ID>.md`. Copy its acceptance criteria verbatim; they become the checklist
- The spec, if one exists in `docs/specs/` — what was planned, and where the build departed from it

If the branch has no ticket ID in its commits or name, ask which ticket it is for. Do not guess.

### 2. Establish what was actually verified

This is the section Marcus reads first, and the one that gets PRs bounced.

- Run `npm test` in `build-battle/merchant-console/` yourself, now, and record the summary line. That is a verification you ran and can report.
- For anything else — a browser click-through, a `curl` against a route, a build — include it **only** if it appears in this conversation or the user tells you they did it. Quote the command and what it showed.
- Anything not covered by the two rules above is written as **Not verified:** with what would verify it. A blank or an honest gap is acceptable. An invented run is not.

### 3. Check every acceptance criterion against the diff

One by one. For each, find the code in the diff that satisfies it, or find that nothing does.

- Met and verified → ticked.
- Implemented but not exercised → ticked, with a note saying exactly what was not exercised.
- Partly done → unticked, with a note saying which part is missing.
- Not done → unticked.

An unmet criterion reported honestly reads as a decision. The same criterion left ticked reads as a lie once the reviewer finds it, and they will.

### 4. Write it in this format, in this order

```
Title: <TICKET-ID>: <what it does, in plain words>

## What changed
One paragraph. What can someone do now that they could not before? Written for a person, not a changelog — the diff is already the file list.

## How I verified it
The commands actually run and what they output. Test summary lines verbatim. What was clicked and what appeared, if that happened. "Not verified:" lines for the gaps.

## Acceptance criteria
The ticket's checkboxes, copied verbatim, ticked per step 3, with a note on any that are partial.

## Deliberately not done
Out-of-scope items from the ticket, follow-ups, known rough edges, bugs noticed and left alone (name the file and the cause). Nothing here is a weakness; leaving it out would be.
```

### 5. Print it, then stop

Print the finished description as a single block the user can paste. Do not open, edit, or comment on a pull request. That is the user's call, and they will say so if they want it.

## Rules

- **Never claim a verification that was not run.** The only verification this skill runs itself is `npm test`. Everything else comes from the conversation or the user, quoted, or is listed under Not verified. If in doubt, it goes under Not verified.
- **Plain language over ceremony.** "Ops can now pick the columns in the export" beats "implemented column selection functionality".
- **Facts from git and the ticket, not from memory.** Every claim about the change traces to a line in the diff; every criterion traces to the ticket file.
- **Say what you did not do.** The "Deliberately not done" section is required, even when it is one line.
- **Keep it scannable.** Short paragraphs, real bullets, no emoji, no closing summary.
