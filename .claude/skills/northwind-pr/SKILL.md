---
name: northwind-pr
description: Write a pull request description in the Northwind team format — title, what changed, how it was verified, acceptance criteria, and what was deliberately left undone. Use when the user invokes /northwind-pr, or asks for a PR description for Northwind work.
---

# /northwind-pr

Write the pull request description for a branch, in the format this team requires.

Takes an optional branch: `/northwind-pr NWP-201-issue-cards`. With no argument, the target is the current `HEAD`. Pass one when the branch you are describing is not the branch you are standing on, which is the normal case inside a worktree.

## What to do

### 1. Read the branch before writing a word about it

Run all four against the target. Do not draft a section that rests on something you have not read.

- `git diff main...<target> --stat`, then the diff itself — what actually changed
- `git log main..<target> --oneline` — how it was sequenced
- The ticket in `docs/tickets/` — the acceptance criteria, verbatim
- `docs/specs/` — the spec for this branch, if one exists, and where the build departed from it

If there is no ticket, say so rather than inventing an ID. If there is no spec, that is a fact about the branch, not a gap to paper over.

### 2. Separate what you ran from what someone else ran

These are different claims and the description must not blur them.

- **Executed here.** A command you ran in this session. Quote its real output.
- **Recorded.** A result written down in a spec, a commit message, or an earlier description. Attribute it: "recorded in `docs/specs/…`". You did not watch it happen.

A spec's verification table is the second kind. Copying it under a heading that says "how I verified it" turns someone else's evidence into your claim, which is the failure this skill exists to prevent.

If you ran nothing and can find no record, write that. An empty verification section is honest and a reviewer can act on it.

### 3. Check each acceptance criterion against the code

Go one at a time. Find the code that satisfies it, or find that nothing does. Half-done is reported as half-done, naming which half.

An unmet criterion stated plainly costs less than one left out, because the reviewer finds it either way, and only one of those reads as a mistake rather than a lie.

### 4. Write the five sections

- **Title** — `<TICKET-ID>: <what it does>`. When the change has no ticket, use a short descriptive subject in the style of the repository's own history, and say which rule you applied.
- **What changed** — one paragraph, plain language. What can the app do now that it could not before? Not a file list; the diff is already that.
- **How I verified it** — the commands and their output, split as in step 2. Name what you clicked and what appeared on screen.
- **Acceptance criteria** — the ticket's checkboxes, ticked honestly, partial ones annotated.
- **Deliberately not done** — out of scope, deferred, or left for a follow-up, and why. Findings you are reporting rather than fixing go here too, with the file and the root cause rather than the symptom.

Where a submission must fill `.github/pull_request_template.md`, its six headings map cleanly except one: "Deliberately not done" becomes "Notes for the reviewer".

### 5. Print it, then offer to open it

Print the description in full. Then offer the command:

```bash
gh pr create --title "<title>" --body-file <file>
```

Ask first. Opening a pull request is the user's call, not yours.

## Rules

- **Never claim a verification step that was not run.** Not executed means not written. This is the one rule that outranks completeness.
- **Quote real output.** A pasted summary line is evidence. "Tests pass" is an assertion.
- **Say what you did not do.** A stated limit is information; a discovered one is a problem.
- **Plain language over ceremony.** "Ops can pick the columns before downloading" beats "implemented configurable export functionality".
- **No emoji, no filler, no summary of the summary.**
