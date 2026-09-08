---
name: northwind-pr
description: Write a pull request description in the Northwind team format — title, what changed, how it was verified, acceptance criteria, and what was deliberately not done. Use when the user asks to write or draft a PR description, invokes /northwind-pr, or when /submit needs a body for the pull request it is about to open.
---

# /northwind-pr

Write the pull request description for the work on this branch, in the format the Northwind team requires.

This skill writes the description. It does not open the pull request — `/submit` does that, and calls this skill for the body.

## 1. Read before you write

Do not draft a line until you have run all three and read the ticket. The description is a report on what happened, and you cannot report on what you have not looked at.

```bash
git log main..HEAD --oneline    # how the work was sequenced
git diff main...HEAD --stat     # what changed, at a glance
git diff main...HEAD            # what changed, actually
```

Then read `docs/tickets/<TICKET-ID>.md`. The ID comes from the branch name — `NWP-101-export-options` gives `NWP-101`. Read the acceptance criteria verbatim; you will be ticking them.

If `docs/specs/<TICKET-ID>-*.md` exists, read it too and note where the build departed from the plan. A departure is worth a line in the description. An unexplained one is worth a question before you write.

## 2. Check every acceptance criterion against the code

Go criterion by criterion. For each, find the code that satisfies it — a file and a line — or find that nothing does.

Intent does not count. If a criterion is half met, say which half. An unmet criterion reported honestly reads as engineering judgment; the same criterion ticked silently reads as a lie, and the reviewer finds it either way.

## 3. Establish what was actually verified

This is the step the format lives or dies on. Before writing the verification section, list every claim you intend to make, and for each one name the command that produced it and what it printed.

If you cannot point at a real run, you have exactly three options:

- **Run it now** — then you can write it
- **Drop the claim**
- **Write it as unverified** — "not checked in the browser" is a perfectly good sentence

Three things that are not verification:

- **A spec or ticket that says the work was verified.** That is someone's earlier claim, not your observation. Re-run it, or attribute it to them.
- **A test that exists.** Passing is the claim; only a run establishes it.
- **Code that looks correct.**

## 4. Write the description

**Title** — `<TICKET-ID>: <what it does>`. Lowercase imperative after the colon: "NWP-101: add export options", not "NWP-101: Added Export Options Feature".

**What changed** — one paragraph, plain language, about what the app can do now that it could not before. Write it for someone who has not read the ticket. Not a file list; the diff is already a file list.

> Ops can now choose which columns an export contains, and whether it covers the current filter or every payment. Card last four is off by default, so a file going to a merchant no longer needs hand editing first.

**How I verified it** — the commands and what they output. Name what you clicked and what appeared.

> Weak: "Tests pass. Checked it in the browser."
>
> Evidence: "`npm test` — 36 passing, including the four `parseExportColumns` cases. In the browser at `/payments?status=disputed`, the dialog opened with 'Card last four' unchecked and the scope labels read 'Current filter (33 payments)' and 'All payments (1,658 payments)'."

**Acceptance criteria** — the ticket's checkboxes, copied verbatim, ticked truthfully. Partial credit gets a ticked line with a note, or an unticked line with a sentence. Never a silent tick.

**Deliberately not done** — what you left out and why. Out-of-scope defects you found and did not fix (name the file and the root cause, not the symptom), work left for a follow-up ticket, known rough edges, the test you meant to write. Name the owning ticket if there is one.

This section is not an apology. A stated limit is a scoped change; an unstated one is a surprise in review.

## 5. Hand it off

Print the finished description. Then:

- If the user wants it opened, use `/submit`. It pushes to their fork and opens the PR cross-repo against `JJFromTenex/claude-code-training`. Do not hand-roll `gh pr create` — nobody has push access to that repo, and a plain create targets the wrong one.
- Otherwise write it to a file and say where it is.

Opening a pull request is the user's call, not yours.

## Rules

- **Never claim a verification step that was not run.** No exceptions, no inference, no borrowing someone else's claim.
- **Plain language over ceremony.** "Ops can choose the columns" beats "implemented configurable column selection".
- **Say what you did not do.** Every time, in its own section.
- **Copy acceptance criteria verbatim.** Rewording them to match what was built is how a miss gets buried.
- **Keep it scannable.** Short paragraphs, real bullets, a table once there are more than three parallel facts.
- **No emoji, no filler, no summary of the summary.**

## Why this exists

The reviewer reads this before the diff, and it sets what they go looking for. A description that says plainly what was built, what was proven, and what was left lets them spend their attention on the risky part.

A description that overstates verification is worse than no description at all: it aims that attention away from exactly the place it should go. It only has to be caught once to make everything else you write suspect.
