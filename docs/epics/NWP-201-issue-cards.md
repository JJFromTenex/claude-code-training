# EPIC · NWP-201 — Issue virtual cards from the console

> Written before the code, then edited by hand. **Ticket:** [NWP-201](../tickets/NWP-201.md)

## Problem

Ops issues cards by messaging the platform team, who create them by hand. Hours
per card, twelve to twenty a week, and two went out last month with the wrong
limit because the request lived in a Slack thread. Put it in the console so the
limit is typed once, by the person who owns it, into a field that validates.

## Current state

No card feature yet — `merchant-console/CLAUDE.md`: "Cards is NWP-201 and does
not exist yet." What exists and must be reused:

- `src/data/store.ts` — store on `globalThis.__northwindStore`. No `cards`, and
  the pin is dev-only, which matters: cards are the first feature that *writes*.
- `src/data/generate.ts` — one shared `mulberry32(SEED)` closure. **A draw
  inserted mid-file shifts every record after it** and breaks `queries.test.ts`.
- `src/data/queries.ts` — the one payment query builder. Not reusable for cards,
  but its shape is the pattern to copy.
- `src/lib/money.ts:46` — `parseAmountToMinorUnits` already converts `"250.00"`
  at a boundary. A second limit parser is the defect the rubric names.
- `src/lib/dates.ts` — `formatDate` (UTC) and `formatInZone` (merchant's zone).
- `src/components/ui/payments/StatusBadge.tsx` — one badge keyed by three
  `Record<AnyStatus, …>` maps. Card statuses go in those, not a new component.
- `src/app/payments/page.tsx` / `[id]/page.tsx` — list and detail patterns.
- `src/app/siteConfig.ts` + `AppSidebar.tsx` — nav needs an entry in both.

**Ticket vs. code:** the ticket says "form or dialog", but `main` has no centred
modal (`Dialog` arrives with NWP-101), so this ships as a form.

## Rules that must hold

Money is integer minor units, formatted once at the edge (`CLAUDE.md`). Every
generated number starts `4242` with a valid Luhn digit, fixtures included, and
is generated on the server (`rules/cards.md`). Reveal once — never on the
record, never in a list or detail payload. `active ⇄ frozen`, either to
`cancelled`, guarded on the server. Everything from the client is allowlisted,
with one error shape and a message safe to show a user (`rules/api-routes.md`).
No database, ORM, or migrations.

## Approach

Cards become a fourth entity beside payments, disputes and payouts, following
the layering already here: types → store → access module → routes → pages.
`src/data/cards.ts` is the single card path, in the role `queries.ts` plays for
payments. Generation and the state machine go in `src/lib/cards.ts` beside the
other pure helpers, each with a `.test.ts` next to it. `issueCard` stores only
`last4` and a `reference`, so no later route has a field to leak. List and
detail are server components reading the store directly, per `CLAUDE.md`.

**Rejected:** a `/cards/new` page redirecting to the created card. Conventional,
but reveal-once makes it wrong — the number would travel in a query string or a
"just created" flag, both a second place it can be re-read. Also rejected:
seeding cards off the shared `rand`, which would shift every payment after it.

## Plan

1. Types and pure helpers — done when the `4242` prefix, a valid check digit,
   and a refused `cancelled → active` all pass.
2. Store and access module — done when `npm test` is green, i.e. the new seed
   draw moved no payment.
3. Routes — done when curl returns the number once, `400` for a missing
   merchant / `0` / `5_000_001` / `JPY`, and `409` out of `cancelled`.
4. **Read the diff.** Minor units end to end? Validation on the server? Any
   helper reimplemented?
5. List and detail, plus nav and badge statuses.
6. Form and success screen — the number shows once, dismissing clears it.
7. Stretch, in order — freeze/unfreeze, spend progress, category lock, written
   error states.

## Risks and scope

Seed drift, mitigated by keeping cards off the shared `rand`. PAN leak,
mitigated structurally: `Card` has no field for a full number. Out of scope:
persistence (NWP-203), auth, real network calls, editing a limit (NWP-202).
