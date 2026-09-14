# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Saurabh Suri
**Status:** building

## Problem

Ops asks the platform team for a virtual card over Slack, and the platform team creates it by hand. It takes hours, happens 12–20 times a week, and last month two cards went out with the wrong spend limit because the limit lived in a chat thread. Marcus wants ops to issue, list, and inspect cards from the console itself.

## Current state

All paths below are under `build-battle/merchant-console/`.

- `src/data/types.ts` — domain types (`Merchant`, `Payment`, `Refund`, `Dispute`, `Payout`, `Currency = "USD" | "EUR" | "GBP"`). No card type exists.
- `src/data/store.ts` — in-memory `Store` held on `globalThis`, populated once by `generate()` at boot. No `cards` collection.
- `src/data/generate.ts` — deterministic seed (`mulberry32`, `SEED = 20260813`, `GENERATED_AT = 2026-08-13T00:00Z`). Seeded records make bugs reproduce identically on every machine.
- `src/data/queries.ts` — `parseFilters` (allowlist-checks client params), `paymentById`, etc. The pattern for "validate at the boundary, then read the store".
- `src/data/merchants.ts` — ten merchants, each with `currency` and `timezone`; `merchantById`.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)`, `parseAmountToMinorUnits("250.00") → 25000`, `sumMinorUnits`. Tested in `money.test.ts`.
- `src/lib/dates.ts` — `formatDate` (UTC, for tables), `formatInZone` (merchant timezone, for detail pages).
- `src/app/api/payments/route.ts` — the route-handler pattern: parse with an allowlist, call the store, `NextResponse.json`. `export/route.ts` shows the 400 error shape: `{ error: "<user-safe message>" }`.
- `src/app/payments/page.tsx` — server-rendered table using `TableRoot/Table/...` from `src/components/Table.tsx`, with a written empty state (`No payments match these filters`).
- `src/app/payments/[id]/page.tsx` — detail page pattern: `notFound()` on a missing id, `<dl>` with a local `Field` helper, `formatInZone` for timestamps.
- `src/app/payments/export-dialog.tsx` — the client dialog pattern: Radix `Drawer` from `src/components/Drawer.tsx`, `useId` for label ids, `fetch` against a route handler.
- `src/components/ui/payments/StatusBadge.tsx` — one badge for every status enum in the app; card statuses go here, not in a second badge.
- `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx`, `src/app/siteConfig.ts` — nav is a static list; `/cards` must be added to all three.
- `vitest.config.ts` — Node environment, `src/**/*.test.ts`. No DOM, so tests cover pure modules only.
- Ticket vs code: the ticket says "seeded from JSON"; the seed is actually generated in `src/data/generate.ts`. Seed cards go there.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` §1, `.claude/rules/money.md` | Two cards with the wrong limit — the exact bug this ticket exists to stop |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `.claude/rules/cards.md` | Repo contains something resembling a real PAN |
| "The full number is returned exactly once, in the creation response. After that, last four only." | `.claude/rules/cards.md`, `api-routes.md` | Card numbers leak through list/detail payloads |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Validate on the server … against an allowlist before it reaches … the store." | `.claude/rules/api-routes.md` | Client sends `currency: "XYZ"` or a negative limit and the store accepts it |
| "Use what is here … Every input has a label, the dialog has an accessible name" | `.claude/rules/components.md` | Inaccessible form; a second dialog implementation |
| "Do not add a database, an ORM, or migrations." | ticket, `merchant-console/CLAUDE.md` | Wasted clock, zero points |

## Approach

Add a `Card` record to the existing in-memory store and a pure card module in `src/lib/` (number generation, Luhn, masking, status transitions) with tests beside it, mirroring `money.ts`. Put validation and store writes in `src/data/cards.ts`, following `queries.ts`. Expose `GET/POST /api/cards` and `GET/PATCH /api/cards/[id]`; the POST response is the only place the full number ever exists — the stored record holds `last4` and a `numberRef`. On top, a server-rendered `/cards` list, a `/cards/[id]` detail with a spend bar, and one client dialog (Drawer) that issues a card and shows the number once on its success screen. Freeze/unfreeze/cancel are client buttons that PATCH and call `router.refresh()`, so no full reload.

Wire format for the limit is integer minor units (`spendLimit: 25000`). The dialog converts the typed `"250.00"` with the existing `parseAmountToMinorUnits`; the server independently enforces integer, `> 0`, `≤ 5_000_000`, and currency allowlist. The client parse is convenience, the server check is the enforcement.

**Considered and rejected:**
- Storing the full PAN and masking at render time — violates the reveal-once rule outright; the record never holds it.
- Accepting `"250.00"` strings on the API and parsing server-side — two accepted shapes for one field is where the second wrong limit comes from; one integer field, validated once.
- A new `CardStatusBadge` component — `StatusBadge` already handles every status enum; add three entries.
- Seeding zero cards — then "spend against limit" is always 0/limit and the amber bar can never be seen. Seed a handful of cards with deterministic spend so the list, detail, and progress bar are all checkable on first load.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, `Card` |
| `src/lib/cards.ts` | add | `generateCardNumber` (4242 BIN + Luhn), `luhnCheckDigit`, `isLuhnValid`, `maskCardNumber`, `canTransition`, `CARD_TRANSITIONS`, `CARD_CATEGORIES` |
| `src/lib/cards.test.ts` | add | Luhn, BIN, length, masking, every legal and illegal transition |
| `src/data/cards.ts` | add | `parseIssueCardInput` (allowlist + limit bounds), `issueCard`, `cardById`, `listCards`, `transitionCard` |
| `src/data/generate.ts` | change | seed a few cards with deterministic spend |
| `src/data/store.ts` | change | `cards: Card[]` |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue (returns `number` once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail (masked), `PATCH { status }` guarded by the state machine |
| `src/app/cards/page.tsx` | add | list table, empty state, dialog trigger |
| `src/app/cards/issue-card-dialog.tsx` | add | form + success/reveal screen, error state |
| `src/app/cards/card-actions.tsx` | add | freeze/unfreeze/cancel buttons, `router.refresh()` |
| `src/app/cards/[id]/page.tsx` | add | full record + spend progress |
| `src/app/cards/spend-progress.tsx` | add | bar, amber past 80%, red at/over limit |
| `src/components/ui/payments/StatusBadge.tsx` | change | `active`, `frozen`, `cancelled` |
| `AppSidebar.tsx`, `Breadcrumbs.tsx`, `siteConfig.ts` | change | Cards in nav |

## Plan

1. **Types + `src/lib/cards.ts` + tests** — done when: `npm test` passes with Luhn/BIN/mask/transition cases, and the generator produces 16-digit `4242…` numbers that pass `isLuhnValid`.
2. **`src/data/cards.ts` + store + seed** — done when: `store.cards` has seeded records with `last4` only, and `parseIssueCardInput` rejects the four ticket cases.
3. **Routes** — done when: `curl -X POST /api/cards` with a valid body returns 201 with `number` and `card`; `GET /api/cards` and `GET /api/cards/:id` never contain `number`; the four invalid bodies return 400; `PATCH` on a cancelled card returns 409.
4. **List page + dialog** — done when: `/cards` renders seeded cards, the dialog issues a card, the success screen shows the full number, closing it and reopening shows `•••• dddd`, and the new card is in the list.
5. **Detail + spend bar + actions** — done when: `/cards/:id` shows the record and a bar; a seeded card past 80% shows amber; Freeze on the list flips the badge without a reload.
6. **Nav, `/ship-ready`, org-standards, PR** — done when: `npm test`, `tsc`, `lint` are green and the PR description lists what was verified.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | `curl -X POST` returns 201; browser: submit dialog, card appears in list |
| Card list at `/cards` | screenshot of table with nickname, merchant, masked number, limit, status, created |
| Card detail | open a seeded card; record + spend/limit rendered |
| Generated numbers | `cards.test.ts`: starts `4242`, 16 digits, Luhn valid, unique across 1000 draws |
| Reveal once, mask forever | POST body has `number`; `GET` list/detail bodies grep clean for it; UI shows `•••• dddd` |
| Server-side validation | `curl` each of: no merchant, `spendLimit: 0`, `-1`, `5000001`, `currency: "CAD"` → 400 with message |
| Stretch: freeze/unfreeze | click Freeze on list; badge changes; network tab shows PATCH, no document reload |
| Stretch: spend progress | seeded card at >80% renders amber class |
| Stretch: category lock | field on dialog, shown on list and detail |
| Stretch: tests | `npm test` summary line |
| Stretch: empty/error states | empty table copy; dialog shows server error message on 400 |

## Risks

- The dev server keeps `store` on `globalThis`; adding `cards` to the `Store` shape means restarting the dev server once, or the old object lacks the field. Guard with `store.cards ??= []` is not enough for seeds — restart.
- `Math.random` in the generator is fine for test-BIN numbers; note it is not a secure PAN generator and never needs to be.
- Client `parseAmountToMinorUnits` returning `null` on bad input must surface as a form error, not a `NaN` sent to the server.

## Out of scope

- Persistence (NWP-203), editing a limit after issue (NWP-202), auth, real issuer calls.
- Card transactions: `spent` is a stored counter on the card, seeded for existing cards and `0` for new ones. Recording spend against a card is not part of this ticket.

## Open questions

- Whether the merchant's own currency should be the default in the dialog. Defaulting to it is cheap and stops the "picked the wrong currency" mistake; done as a default, still overridable.
