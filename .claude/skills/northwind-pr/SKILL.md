---
name: northwind-pr
description: Write a Northwind Payments PR description in the house format (Title, What changed, How I verified it, Acceptance criteria, Deliberately not done). Use when opening or updating a pull request for a ticket in this repo.
---

# /northwind-pr

Write the pull request description for the current branch, in the house format Marcus expects — shorter than the full template, no ceremony, nothing claimed that wasn't actually run.

## Before writing anything

Read these, in order, and do not skip any:

1. `git log main..HEAD --oneline` — how the work was sequenced
2. `git diff main...HEAD --stat` and then the full diff — what actually changed
3. The ticket file in `docs/tickets/<TICKET-ID>.md` — the acceptance criteria, verbatim
4. The epic in `docs/epics/`, if one exists for this ticket — what was planned vs. what shipped

Do not draft a single section before doing all four. A description written from memory instead of the diff is the failure mode this skill exists to prevent.

## Format

```
Title: <TICKET-ID>: <what it does, plain language, not a file list>

What changed
<one paragraph, plain language. What can the app do now that it couldn't before?
Not a list of files — the diff is already that.>

How I verified it
<the actual commands you ran and the actual output you saw. Quote real numbers
(e.g. "npm test — 34 passing") and real curl/click results. If you did not run
something, do not describe running it — leave it out or say it wasn't checked.>

Acceptance criteria
<copy the ticket's checkboxes, ticked [x] only for what the code actually does.
Leave [ ] unticked for anything not done or only partly done, and say which part.>

Deliberately not done
<scope cut, follow-ups, stretch goals not attempted. Stating a limit here is a
sign of a careful PR, not a weak one.>
```

## Rules

- **No invented verification.** If a step wasn't run this session, it doesn't appear as something you did. Past tense is a claim — only write it for things that actually happened.
- **Partial credit is real.** A criterion that's half met gets ticked `[ ]` with a one-line note on what's missing, never rounded up to `[x]`.
- **Plain language over ceremony.** "Ops can filter which columns export" beats "implemented configurable column export functionality."
- **This repo's PR template** (`.github/pull_request_template.md`) has more sections (Bugs fixed along the way, Notes for the reviewer). Fold this skill's five sections into that template when opening the actual PR — this format is the content, the template is the container.

## After drafting

Print the finished description. Opening the PR (`gh pr create`) is a separate, explicit step — ask before running it, don't run it as part of drafting.
