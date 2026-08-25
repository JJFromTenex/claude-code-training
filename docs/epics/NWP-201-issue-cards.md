# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** marcosg
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — hours
of turnaround, 12–20 times a week, and last month two cards went out with the wrong spend
limit because the request lived in a Slack thread. Merchants need these cards (vendor
subscriptions, ad spend, contractor tools) with a limit from the moment they exist. Marcus
Bell (Head of Merchant Ops) wants issuing, listing, and inspecting a card in the console.

## Current state

Cards do not exist yet. NWP-201 introduces the first write path in the app.

- `src/data/types.ts:1` — `Currency = "USD" | "EUR" | "GBP"`. No `Card` type or `CardStatus`.
- `src/data/store.ts:16-22` — `Store` has `merchants, payments, refunds, disputes, payouts`;
  **no `cards`**. Cached on `globalThis.__northwindStore` (`store.ts:24-38`).
- **No mutation exists anywhere in `src/`.** All routes are GET (`src/app/api/payments/route.ts`,
  `.../export/route.ts`). No `store.*.push`/status write outside the generator. This ticket
  writes the first one. The "writes survive the session" note (`store.ts:8-10`) is aspirational
  until now.
- IDs are `prefix_zeropadded` via `pad(n, 6)` (`generate.ts:55`): `pay_`, `re_`, `dp_`, `po_`.
  Sequences are local counters inside `generate()`; there is **no runtime ID generator** — a
  card write path needs its own counter/scheme.
- `src/data/merchants.ts:90` — `merchantById(id)` already exists for the merchant lookup.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` (:15), `parseAmountToMinorUnits(input): number | null`
  (:46, regex `^\d+(\.\d{1,2})?$`). Use these; do not write a second formatter/parser.
- `src/data/queries.ts:18` — `parseFilters` is the server-side allowlist pattern to mirror
  (membership-check-then-default, e.g. `STATUSES.includes(...)`).
- `src/app/payments/page.tsx` — async server component, `await searchParams` (Next 15), calls
  `queryPayments`, renders with `Table*` primitives + `StatusBadge`, formats money at the edge.
- `src/app/payments/[id]/page.tsx:127-140` — inline `Field` helper (`<dt>/<dd>`) + `notFound()`.
- `src/app/payments/export-drawer.tsx` — the working reference for a **client** form in a
  `Drawer` (Radix dialog). There is **no `Dialog.tsx`** despite the components rule; `Drawer.tsx`
  is the only modal primitive.
- `src/app/siteConfig.ts:5-10` + `src/components/ui/navigation/AppSidebar.tsx:26-51` — where a
  top-level nav route is registered (lucide icon, `navigation` array).
- `src/components/ui/payments/StatusBadge.tsx:7-50` — status→variant/label/dot maps; needs
  card statuses added or a parallel `CardStatusBadge`.
- **No `ProgressBar`/Tremor progress primitive exists.** The spend bar is a hand-rolled Tailwind
  track+fill (no inline `style`, per components rule).
- Tests: Vitest named imports (`import { describe, expect, it } from "vitest"`), co-located
  `*.test.ts` beside the helper, `@/` = `src/`.

**Ticket vs. code mismatch to flag:** the components rule lists a `Dialog`; it isn't in the repo.
Use `Drawer`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; format once at the edge | `CLAUDE.md` §1, ticket rule 1 | Limits drift; `$250.00` must be `25000` |
| Full PAN returned exactly once (creation response), masked `•••• 4242` everywhere else | ticket rule 2, `cards.md` | Storing/redisplaying a PAN is a shippability failure (#8) |
| Status state machine `active ⇄ frozen`, either → `cancelled` (terminal), guarded server-side | ticket rule 3, `cards.md` | Illegal transitions corrupt card state |
| Generated numbers: `4242` BIN + valid Luhn, server-side only | ticket rule 4, `cards.md` | Anything resembling a real PAN is forbidden |
| Validate on the server against an allowlist | `CLAUDE.md` §4, `api-routes.md` | Client-trusting validation is not enforcement (#7) |
| One query builder / no second lookup implementation | `CLAUDE.md` §3 | A parallel builder is a defect (#6) |
| Consistent error shape `{ message }` + status | `api-routes.md` | Inconsistent 400s |

## Approach

Add a `Card` type and a `CardStatus` union, a `cards: Card[]` array to the store, and a small
`src/data/cards.ts` module holding the runtime write path: an ID counter, sequential IDs
(`card_000001`), Luhn generation on the `4242` BIN, a validated `issueCard`, a guarded
`setCardStatus`, and read helpers (`allCards`, `cardById`) — this is the "one builder" for
cards, mirroring `queries.ts`. A `POST /api/cards` route validates input server-side against
the currency allowlist and limit bounds, returns the full PAN **once**; a `PATCH /api/cards/[id]`
guards status transitions. UI: a `/cards` server-component list, a `/cards/[id]` detail (record +
hand-rolled Tailwind spend bar reading a `spend` field), and a client `Drawer` issue form modeled
on `export-drawer.tsx`, with the reveal-once success screen. `spend` is a `Card` field initialized
to `0` at issue (decided with the reporter) — no fabricated linkage to `payments`. Nav entry via
`siteConfig` + `AppSidebar`.

**Considered and rejected:** deriving spend by joining cards to existing `payments` by merchant.
Rejected — the data model has no card↔payment link, it would invent a relationship and a second
query path (#6 risk) for a number that is 0 for every freshly issued card anyway.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `Card`, `CardStatus`, `MerchantCategory` (stretch) |
| `src/data/store.ts` | change | Add `cards: []` to `Store` + `createStore()` |
| `src/data/cards.ts` | add | ID counter, Luhn PAN gen, `issueCard`, `setCardStatus`, `allCards`, `cardById` — the single card builder |
| `src/data/cards.test.ts` | add | Luhn validity + status-transition unit tests (stretch) |
| `src/app/api/cards/route.ts` | add | `POST` issue: server validation, reveal-once PAN |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` freeze/unfreeze/cancel, guarded |
| `src/app/cards/page.tsx` | add | Card list (async server component) |
| `src/app/cards/[id]/page.tsx` | add | Card detail + spend bar |
| `src/app/cards/issue-drawer.tsx` | add | Client issue form + reveal-once success screen |
| `src/app/cards/card-actions.tsx` | add | Client freeze/unfreeze buttons (stretch, no full reload) |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | `active/frozen/cancelled` badge (parallel to `StatusBadge`) |
| `src/app/siteConfig.ts` | change | `cards: "/cards"` link |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Nav entry + lucide icon |

## Plan

1. **Types + store** — add `Card`/`CardStatus`, `cards: []` to store — done when: `npm run build` typechecks with an empty cards array reachable.
2. **`src/data/cards.ts`** — ID counter, Luhn `4242` generator, `issueCard` (validates merchant exists, limit 1..5_000_000, currency ∈ USD/EUR/GBP), `setCardStatus` (state machine), `allCards`, `cardById` — done when: unit tests in `cards.test.ts` pass (`npm test`), Luhn check digit validates, illegal transitions rejected.
3. **`POST /api/cards`** — parse+validate body, call `issueCard`, return card with full PAN once + `{ message }` 400 on bad input — done when: issuing returns 201 with PAN; invalid currency/limit/merchant each return 400.
4. **`/cards` list page** — server component reads `allCards()`, renders `Table*` + `CardStatusBadge`, PAN masked `•••• 4242`, `formatMoney` at edge, written empty state — done when: issued cards appear; empty state shows with none.
5. **Issue drawer** — client `Drawer` form (nickname, merchant `Select`, limit `Input`, currency `Select`), POSTs, shows reveal-once success screen with full PAN, then list refresh — done when: issuing from UI adds the card and reveals the number exactly once.
6. **`/cards/[id]` detail** — `Field` grid of the record + hand-rolled Tailwind spend bar (`spend`/`limit`, amber past 80%), `notFound()` on miss — done when: opening a card shows its record and 0% bar.
7. **Nav** — `siteConfig` + `AppSidebar` entry — done when: sidebar shows Cards, active state works.
8. **Stretch** — `PATCH /api/cards/[id]` + `card-actions.tsx` freeze/unfreeze without full reload; merchant category at issue; error states — done when: freeze toggles in place; `npm test` green.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card (form → appears in list) | Click through issue drawer; card row appears |
| `/cards` list with required columns | Visit `/cards`; columns present, PAN masked |
| Card detail with spend against limit | Open a card; record + spend bar render |
| Server-side Luhn `4242` generation | `cards.test.ts` Luhn test; inspect PAN prefix |
| Reveal once, mask forever | Success screen shows PAN; list/detail show `•••• 4242` |
| Server-side validation | Bad merchant/limit/currency → 400 `{ message }` |
| Stretch: freeze/unfreeze no reload | Toggle in list; `PATCH` updates in place |
| Stretch: tests pass | `npm test` green, incl. transition tests |

## Risks

- **First write path** — store writes only persist for the dev-server life; that is expected (NWP-203). Do not add a DB/ORM.
- **PAN leakage** — the full number must never be stored beyond the last4/reference, nor re-returned. Guard the response shape.
- **Second builder** — keep all card lookups in `src/data/cards.ts`; do not fork a parallel filter.

## Out of scope

- Persistence (NWP-203), auth/roles, real card-network calls, editing a card's limit after issue (NWP-202).

## Open questions

- None blocking. Spend source resolved: a `spend` field on `Card`, initialized `0` at issue.
