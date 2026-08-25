# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build:
> `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Vyoma Gajjar
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes
hours, happens twelve to twenty times a week, and last month two cards were created with the
wrong spend limit because the request lived in a Slack thread. Marcus Bell wants it in the
console: issue a card, see the cards issued, open one to check it.

## Current state

Cards do not exist yet. `merchant-console/CLAUDE.md` says so directly: "Cards is NWP-201 and
does not exist yet." Everything below is what the codebase already provides to build on.

- `src/data/types.ts` — `Currency` is `"USD" | "EUR" | "GBP"` (`:1`). `Merchant` carries its own
  `currency` and `id` (`:14-22`). There is no `Card` type.
- `src/data/store.ts:16-21` — the in-memory `Store` interface holds merchants, payments, refunds,
  disputes, payouts. No cards array. Held on `globalThis` (`:34`) so dev-server reloads do not
  hand each request a fresh copy.
- `src/data/generate.ts:20-28` — `mulberry32`, a deterministic seeded PRNG, plus `GENERATED_AT`
  (`:58`), the fixed clock the rest of the seed data is built around.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` (`:15`) and
  `parseAmountToMinorUnits(input)` (`:46`), which is explicitly the boundary parser for user
  input and returns `null` on anything malformed. Both already exist; a second one costs points.
- `src/data/queries.ts:18-36` — `parseFilters` is the house pattern for server-side allowlisting:
  check the client's value against a fixed list, fall back to a safe default.
- `src/components/` — `Drawer` (a complete accessible Radix dialog), `Button`, `Input`, `Select`,
  `Table`, `Badge`. `src/components/ui/payments/StatusBadge.tsx` is the pattern for a status pill.
- `src/app/disputes/page.tsx` — the list-page pattern: a Server Component reading the store,
  a heading with a count, then a `TableRoot`.
- `src/app/payments/[id]/page.tsx` — the detail-route pattern.
- `src/components/ui/navigation/AppSidebar.tsx:26-50` and `src/app/siteConfig.ts:6-10` — nav
  entries come from `siteConfig.baseLinks`; a `cards` entry has to be added to both.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`" | ticket, rule 1 | Limits drift; the reason two cards were wrong last month |
| "Every generated number starts `4242` and carries a valid Luhn check digit" | `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | The number is in client state before it should exist |
| "Reveal once... not on the card record, not in a list or detail payload" | `.claude/rules/cards.md` | The full number becomes re-readable, which is the whole risk |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard on the server" | `.claude/rules/cards.md` | A cancelled card comes back to life from a stale tab |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000, currency outside USD/EUR/GBP" | ticket, core | The client is trusted, which the ticket says it is not |
| No database, ORM, or migration | ticket, out of scope | Costs the clock and earns nothing |

## Approach

A `src/lib/cards.ts` holds the pure logic — Luhn check digit on the `4242` BIN, masking, and the
status transition table — so all of it is unit-testable with the existing node vitest setup and
none of it depends on React or a request. The store gains a `cards` array; `src/data/cards.ts`
owns reads and writes against it, mirroring how `queries.ts` owns payment reads. Two route
handlers do the enforcing: `POST /api/cards` validates every field against an allowlist before a
card exists, and `PATCH /api/cards/[id]` guards the state machine server-side. The full number is
returned by the POST response and never stored on the record, so there is no field to leak later.

The UI is three Server Components (`/cards`, `/cards/[id]`) plus small client islands for the
issue dialog and the freeze control, matching how `src/app/payments/` splits `page.tsx` from
`filter-bar.tsx`.

**Considered and rejected:** generating the number client-side and posting it. Simpler round trip,
but `.claude/rules/cards.md` calls that a bug outright, and it puts a PAN in browser memory and in
the request body for no benefit.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/cards.ts` | add | Luhn generator on the 4242 BIN, masking, status transitions |
| `src/lib/cards.test.ts` | add | Luhn and state-machine tests, beside the code |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `MerchantCategory` |
| `src/data/store.ts` | change | `cards` array in the store |
| `src/data/generate.ts` | change | Seed a few issued cards so the list and detail demo immediately |
| `src/data/cards.ts` | add | Card reads and writes, and spend against a card |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue with full server-side validation |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` status, guarded by the transition table |
| `src/app/cards/page.tsx` | add | The `/cards` list |
| `src/app/cards/issue-dialog.tsx` | add | Issue form and the one-time reveal |
| `src/app/cards/card-actions.tsx` | add | Freeze / unfreeze / cancel without a full reload |
| `src/app/cards/[id]/page.tsx` | add | Card detail with spend against limit |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Status pill, mirroring the payments one |
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | change | `/cards` nav entry |

## Plan

1. **`src/lib/cards.ts` + tests** — done when: `npm test` passes, generated numbers start `4242`,
   pass Luhn, and every legal and illegal status transition is asserted.
2. **Types, store, seed, `src/data/cards.ts`** — done when: `/cards` can be read from the store.
3. **`POST /api/cards` and `PATCH /api/cards/[id]`** — done when: a missing merchant, a zero,
   negative, or over-limit amount, and a bad currency are each rejected with 400; a cancelled card
   refuses every further transition.
4. **`/cards` list, issue dialog, one-time reveal** — done when: issuing shows the full number
   once, and the list shows it masked afterwards.
5. **`/cards/[id]` detail with spend bar** — done when: spend against limit renders and turns
   amber past 80%.
6. **Stretch and polish** — freeze/unfreeze inline, category lock, empty and error states.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Submit the dialog; the card appears in the list |
| Card list | `/cards` renders nickname, merchant, masked number, limit, status, created date |
| Card detail | Open a card; full record and spend against limit |
| Generated numbers | Unit test: `4242` prefix and Luhn valid across many generated numbers |
| Reveal once, mask forever | Reveal on the success screen; `GET` responses carry no full number |
| Server-side validation | `curl`/fetch each rejected case and confirm 400 with a message |

## Risks

- **Time.** Six core criteria in 45 minutes. Core before stretch, in the plan order above.
- **The reveal leaking.** The full number must never be written to the `Card` record. It is
  returned by the POST response only, and the client drops it when the success screen closes.

## Out of scope

Persistence (NWP-203). Editing a limit after issue (NWP-202). Auth and roles. Real network calls.
