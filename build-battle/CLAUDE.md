# Build Battle: Repo Rescue

The exercise wrapper. The application itself lives in `merchant-console/` and has its own CLAUDE.md with the codebase conventions — read that one before writing code.

## What you are doing here

Taking ticket NWP-201 end to end in a codebase you did not write, in 40 minutes, then submitting it as a pull request to be scored.

- Ticket: `docs/tickets/NWP-201.md` at the repository root
- Your plan goes in: `docs/specs/`
- App: `merchant-console/` — read its CLAUDE.md before writing code

## The order that works

1. `@docs/tickets/NWP-201.md` — read it, including the out-of-scope list
2. `/spec docs/tickets/NWP-201.md` — build the context, review what it wrote
3. `@docs/specs/NWP-201-issue-cards.md` — load the plan, then plan mode, then build
4. `/ship-ready` — check yourself
5. `/pr` — write the description
6. Commit, push, open the pull request

## What is preloaded

- Skills: `/spec`, `/pr`, `/ship-ready`
- Subagent: `bug-investigator`, read-only, for diagnosing a report before anyone edits code
- No hooks. Add your own if you want one.

## Workflow rules

- Branch from `main` using the ticket ID: `NWP-201-issue-cards`
- Commit subjects start with the ticket ID: `NWP-201: issue virtual cards`
- Read before you edit. The console already has money helpers, date helpers, and a query builder; a second implementation of any of them costs points
- Never edit seed data to make a failing case disappear
- No database, no ORM, no migrations. The store is in memory on purpose and persistence is a different ticket

## Release Requirements 
- All changes need test evidence before merging
- No direct commits to main
- Every PR must include a one-line business impact summar

## Definition of done

A pull request that states what changed, how it was verified, and which acceptance criteria it meets.
