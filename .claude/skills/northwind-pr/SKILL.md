---
name: northwind-pr
description: Write a pull request description in the Northwind house format — ticket ID in the title, plain-language summary, verification with real command output, honestly ticked acceptance criteria, and what was deliberately left out. Use when the user asks to write, draft, fix, or rewrite a PR description, when a reviewer bounces a description, or when the user invokes /northwind-pr.
---

# /northwind-pr

Write the pull request description for the work in this branch, in the format the team actually requires.

This is the format reviewers send back when it is missing. Getting it right the first time is cheaper than a round trip, and the grader reads it.

## The format

Five required parts, in this order.

1. **Title** — `<TICKET-ID>: <what it does>`. Present tense, lowercase after the colon, no trailing period. `NWP-101: add export options`, not `NWP-101 - Added Export Options Feature`.
2. **What changed** — **one paragraph**, plain language. What can the app do now that it could not do before? One paragraph is the whole constraint, not a soft target. If the change feels too big for one, you are listing files instead of describing behavior. Cut to the before-and-after and the rest will fit.
3. **How I verified it** — the commands actually run and what they actually printed.
4. **Acceptance criteria** — the ticket's checkboxes, ticked honestly, each with the evidence that satisfies it.
5. **Deliberately not done** — what is out of scope, left for a follow-up, or known rough. Never omit this section. "Nothing" is a valid answer only when it is true.

Two further sections come from `.github/pull_request_template.md` rather than from the house format: **Bugs fixed along the way** and **Notes for the reviewer**. They go after "Deliberately not done", and step 5 below covers them. Add nothing beyond these seven.

## What to do

### 1. Gather the facts before writing a word

Do not draft from the conversation's memory of the work. Read the repository.

- `git log main..HEAD --oneline` — how the work was sequenced
- `git diff main...HEAD --stat`, then the diff itself — what actually changed
- The ticket in `docs/tickets/<TICKET-ID>.md` — the acceptance criteria, verbatim
- The spec in `docs/specs/`, if one exists — what was planned, and where the build departed from it
- `.github/pull_request_template.md` — the section headings the grader expects

Take the ticket ID from the branch name. `NWP-101-export-options` gives `NWP-101`. If the branch name has no ticket ID, ask which ticket this is rather than guessing.

### 2. Write "What changed" as a before-and-after

State what the old behavior was, then what the new behavior is. That contrast is what a reviewer needs and what a file list cannot give them.

Name a file only when the reviewer has to open it. The diff is already a file list; do not retype it in prose.

### 3. Write "How I verified it" from evidence, not intent

This is the section reviewers distrust, so it carries the strictest rule in this skill: **every command in it must have actually been run, and its output must be quoted rather than characterized.**

Work through it in this order.

- **Run the checks now.** `npm test` in `build-battle/merchant-console` is the baseline. Run it as part of writing the description rather than trusting an earlier report. It takes seconds.
- **Quote the real summary line.** `Test Files 3 passed (3)`, `Tests 31 passed (31)` is evidence. "All tests pass" is a claim.
- **Name what the new tests cover**, so the reviewer can tell the suite exercises this change and not just the code around it.
- **Separate what you ran from what someone else reported.** If a previous session or the user says a command passed and you cannot reproduce it, either run it yourself or attribute it: "reported passing in an earlier session, not re-run here." Never absorb someone else's claim into your own voice.
- **Say plainly what was not checked.** Browser interaction, a manual click-through, a case you could not construct. An unchecked box with a reason beside it costs nothing. A ticked box that turns out to be false costs the reviewer's trust in the whole description.

Carry over the repository template's three checkboxes and tick them against the same standard:

```
- [x] `npm test` passes
- [x] New behavior is covered by a test
- [ ] Checked it in the browser
```

### 4. Check each acceptance criterion against the code

Go criterion by criterion. For each one, find the code that satisfies it, or find that nothing does. Then write the criterion followed by its evidence in one sentence.

- Met, with evidence: tick it.
- Half done: tick nothing, say which half works and which does not.
- Not done: leave it unticked and say so in the same breath.

An unmet criterion reported honestly scores better than an unmet criterion left unmentioned. The reviewer finds it either way, and one of those reads as a known gap while the other reads as a lie.

### 5. Fill the remaining template sections

The house format is the spine, but the repository template has two sections the grader also reads. Keep them, after "Deliberately not done":

- **Bugs fixed along the way** — anything found outside the ticket. Name the file and the root cause, not the symptom. If a change looks like a bug fix but the ticket's notes called for it, say that rather than claiming extra credit.
- **Notes for the reviewer** — trade-offs, fragile spots, questions you would raise out loud. The most useful note names something that will break later if someone does not know about it.

### 6. Print it, then stop

Write the description to a file and show it. Do not open, edit, or push the pull request from this skill.

If a pull request already exists for this branch, say so and show its current description alongside the new one. Overwriting a description someone already wrote is the user's call, not yours — especially when theirs records verification you cannot reproduce.

## Rules

- **No invented verification.** If you did not run it, do not write that you ran it. This is the fastest way to lose a reviewer, and it is the single reason this skill exists.
- **No paraphrased output.** Quote the summary line the tool printed. If you cannot quote it, you did not run it.
- **Never tick a box you did not verify.** Not the criteria, not the template checkboxes.
- **Always include "Deliberately not done."** A description with no admitted gaps is a description nobody believes.
- **Plain language over ceremony.** "Ops can pick which columns land in the CSV" beats "implemented configurable column selection functionality."
- **No file lists in prose**, no emoji, no restating the summary at the end.
- **Do not edit code from this skill.** If writing the description surfaces a real defect, report it and let the user decide.

## Why this exists

Everyone on the team knows this format and everyone retypes it from memory, which is why every description is slightly different and half of them come back. Writing it down makes it repeatable.

The verification section is the part that matters. A description that overstates what was checked is worse than one that admits a gap, because the reviewer stops trusting the parts that were true.
