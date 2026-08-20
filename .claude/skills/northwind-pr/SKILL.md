---
name: northwind-pr
description: Write a pull request description in the Northwind team's required format. Use when the work on a branch is finished and it is time to open or update a PR — "write the PR", "PR description", "open a pull request". Reads the branch diff, the git log, and the ticket before writing.
---

# northwind-pr

Write the pull request description for the work on this branch, in the format this team requires.

The reviewer reads this before the diff. Write it from what the branch actually contains, never from what you meant to build.

## What to do

### 1. Gather the facts first

Run all of these before writing a single line:

```bash
git log main..HEAD --oneline
```

```bash
git diff main...HEAD --stat
```

Then read the diff itself, and read the ticket in `docs/tickets/` that matches the branch name or the ticket ID in the commit subjects. If you cannot tell which ticket it is, ask.

Read the epic in `docs/epics/` too, if one exists. Where the build departed from the plan is worth a line in the PR.

### 2. Check each acceptance criterion against real code

Go criterion by criterion. For each one, find the code that satisfies it, or find that nothing does. Intent does not count. If a criterion is half met, say which half.

An unmet criterion reported honestly scores better than an unmet criterion left unmentioned. The reviewer finds it either way.

### 3. Write the description

Five sections, in this order, all of them filled in:

**Title** — `<TICKET-ID>: <what it does>`. Present tense, plain language, the ticket ID first so it links. Example: `NWP-201: issue virtual cards from the merchant console`.

**What changed** — one short paragraph in plain language. What can the app do now that it could not do before? Not a file list; the diff already is one.

**How I verified it** — the commands you actually ran and what they actually printed. Paste the real summary line. Name what you clicked in the browser and what appeared. `npm test` — 12 passing, including the Luhn generator case is evidence; "tests pass" is not.

**Acceptance criteria** — the ticket's checkboxes, copied verbatim, ticked truthfully. Add a one-line note under any that are partial saying what is missing.

**Deliberately not done** — anything out of scope, left for a follow-up, or cut on purpose, with the reason in a few words. Include stretch goals you skipped and tests you meant to write. An empty section here reads as an oversight, so say "nothing" outright if that is true.

If `.github/pull_request_template.md` exists, map these sections onto it and leave no placeholder comments behind.

### 4. Offer to open it

Print the finished description. Then offer the command:

```bash
gh pr create --title "<TICKET-ID>: <what it does>" --body-file <file>
```

Ask before running it. Opening a pull request is the user's call.

## Rules

- **Never claim a verification step that was not run.** No invented test output, no "checked in the browser" you did not check. If a check was not run, either run it now or write that it was not run. This is the fastest way to lose a reviewer's trust.
- **No guessed facts.** Every claim traces to the diff, the log, or the ticket.
- **Say what you did not do.** Stating a limit is not a weakness in a PR.
- **Plain language over ceremony.** "Ops can issue a card and see it in the list" beats "implemented card issuance functionality".
- **Keep it scannable.** Short paragraphs, real bullets. A reviewer skims first and reads second.
- **No emoji, no filler, no summary of the summary.**
