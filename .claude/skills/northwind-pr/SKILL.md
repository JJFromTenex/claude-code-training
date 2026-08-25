---
name: northwind-pr
description: Write the pull request description for a Repo Rescue submission in this repo, in the required five-section format (Title, What changed, How I verified it, Acceptance criteria, Deliberately not done). Use whenever the user asks to write the PR, draft a PR description, open a pull request, or prepare a submission for a ticket like NWP-201 — this supersedes the older /pr skill. Gathers facts from git and the ticket itself rather than writing from memory, and will not claim a verification step that was not actually run.
---

# northwind-pr

Write the pull request description for the branch you're on. The reviewer reads this before it reads your diff, and it is scored on its own — a rushed or invented description costs points a working feature would otherwise earn.

## The rule that matters most

**Never claim a verification step that was not actually run.** Not a command you did not execute, not output you did not see, not a browser check nobody performed.

If you did not run it, you do not know it works. Say so and leave the line blank, or mark the criterion unverified. This applies to every section below, but especially "How I verified it" — that section is a report of what happened, not a plan of what should happen.

An honestly-reported gap scores better than a claim a reviewer discovers is false. The reviewer will find it either way — by running the thing themselves, or by reading the diff and seeing nothing there. One of those reads as a mistake made under time pressure. The other reads as a lie, and it changes how they read everything else you wrote.

## Before you write anything

Gather facts. Do not reconstruct the change from memory or from what you intended to build — the diff is the only reliable record of what actually happened.

Run, in this order:

1. `git log main..HEAD --oneline` — how the work was sequenced
2. `git diff main...HEAD --stat` — which files changed, and by how much
3. `git diff main...HEAD` — the actual diff, read it
4. The ticket in `docs/tickets/` for this branch — the acceptance criteria, verbatim, not paraphrased
5. The epic in `docs/epics/`, if one exists for this ticket — what was planned, and note anywhere the build departed from it

If any of these commands fail or come back empty (no ticket found, branch not diverged from `main`), say so to the user before continuing rather than guessing at what the ticket probably said.

## Write the five sections

Use exactly these five sections, in this order. No placeholders left behind — if a section is thin, it's thin, but it still has to reflect something real.

### Title

`<TICKET-ID>: <what it does>`. Imperative, plain, no marketing. "NWP-201: issue virtual cards from the console", not "NWP-201: Implement Amazing New Card Issuance Feature".

### What changed

One plain-language paragraph. Not a file list — the diff already is one, and repeating it here wastes the reviewer's first thirty seconds. Not a bullet list, not a changelog entry per commit.

Write for someone who did not follow the work: what can they do in the app now that they could not do before? "Ops can now issue a virtual card from `/cards`, see it in the list with its masked number, and open it to check its spend" beats "implemented card issuance functionality" or a bullet list of components touched.

### How I verified it

The actual commands you ran and the actual output you saw. Paste the real output, or the material part of it — a test summary line, the exact error, the response body. "Tests pass" is not evidence; "`npm test` — 14 passing, including the Luhn check-digit case" is.

If you clicked through the app in a browser, name what you clicked and what appeared. If you did not do that — no browser was opened this session — do not write a line implying you did.

Build this section only from things you actually did in this session. If the user tells you they verified something themselves (clicked around, ran a command outside your view), you can include it, but attribute it plainly rather than folding it into your own verification.

### Acceptance criteria

Reproduce the ticket's own checkboxes. For each one, go find the code that satisfies it, or find that nothing does — don't mark a box because you meant to get to it.

- Met: check it, and it's fine to note where in the code it's satisfied if that's not obvious.
- Partially met: say so explicitly and name which half is done and which half isn't. "Issuing a card works and validates the limit server-side; the currency allowlist is not yet enforced" is the right level of detail.
- Not met: leave it unchecked. Do not omit the line — an omitted criterion looks like it was never noticed, which is worse than one honestly marked incomplete.

### Deliberately not done

Anything out of scope, deferred, or left rough on purpose. For each, say where it lives instead if it lives somewhere — another ticket ID, a follow-up the user mentioned, or just "not attempted, ran out of time." This section is not an apology; it's information the reviewer needs and would otherwise have to dig for.

## After writing

Print the finished description. Then tell the user to run `/ship-ready` before pushing, if they haven't already — this skill writes the description, it doesn't check the code. Remind them the PR description gets read and scored by a reviewer, so a section built on a guess is worse than a section left honestly incomplete.

Offer to open the PR (`gh pr create --title "<title>" --body-file <file>`) but wait for the user to say go — opening it is their call.

## Why this exists

A description built from memory drifts from what the diff actually contains, and a reviewer who catches one invented claim stops trusting the rest of the document. Gathering facts first and reporting gaps plainly is slower than writing confidently from recollection, but it's the only version of this document that survives contact with a reviewer who actually reads the code.
