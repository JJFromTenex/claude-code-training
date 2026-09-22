# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** you
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — 12-20 times a week, hours of turnaround, and last month two cards got the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants this in the console: issue a card, see the ones already issued, open one to check it.

## Current state

- `src/data/types.ts` has no `Card` or `CardStatus` type yet. `Currency` (`USD | EUR | GBP`) already exists and is reused as-is.
- `src/data/store.ts` holds `merchants`, `payments`, `refunds`, `disputes`, `payouts` on a `globalThis`-pinned in-memory `Store`, generated once at boot by `src/data/generate.ts`. There is no `cards` array. Cards start empty — nothing seeds them, ops creates them through the UI.
- `src/data/queries.ts` is the general data-access module (not payments-only despite its filename intent — it already holds `paymentById`, `refundsForPayment`, `disputeForPayment` alongside the payment query builder). Card query/mutation functions belong here, next to the existing ones.
- `src/app/api/payments/route.ts` and `src/app/api/payments/export/route.ts` show the route-handler shape: parse+validate query params through an allowlist function (`parseFilters`), then call a query function, return `NextResponse.json(...)`.
- `src/lib/money.ts` has `formatMoney`, `parseAmountToMinorUnits` (client-input → minor units, boundary-only), `sumMinorUnits`. No card-number or Luhn helper exists anywhere in `src/lib/`.
- `src/lib/dates.ts` has `formatDate` (UTC, tables) and `formatInZone` (merchant timezone, detail views) — reuse both, do not add a third.
- `src/components/` has `Drawer` (Radix Dialog wrapper, used nowhere yet but built exactly for a create-and-reveal flow), `Input`, `Select`, `Button`, `Badge`, `Table`. No dedicated `Dialog` component exists — `Drawer` is the pattern for "form appears, user submits, something happens."
- `src/components/ui/payments/StatusBadge.tsx` maps a status union to a label/dot/badge-variant. It is payments+disputes+payouts specific (`AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus`); card status needs its own badge, following the same shape, not an edit to this one (card statuses share names with nothing here except conceptually).
- `src/app/payments/page.tsx` + `filter-bar.tsx` show the list-page pattern: server component page reads `searchParams`, calls a query function, renders `Table`; a `"use client"` sibling component owns interactive filter state and pushes a new URL.
- `src/app/payments/[id]/page.tsx` shows the detail-page pattern: `params` → lookup → `notFound()` → `<dl>` fields with `Field` helper.
- `src/components/ui/navigation/AppSidebar.tsx` has a static `navigation` array driving the sidebar; `src/app/siteConfig.ts` holds `baseLinks`. Cards needs an entry in both so the route is reachable, which the ticket doesn't spell out but "put it in the console" implies.
- The ticket's stretch goals (freeze/unfreeze, spend progress, tests) are in scope for this pass per the answered question; merchant category lock and bespoke empty/error copy beyond the core list/detail views are deliberately left out this round.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, one formatter | `CLAUDE.md`, `money.md` | A `$250.00` limit stored as `250` or `"250.00"` corrupts every comparison against spend |
| Full number returned exactly once, masked everywhere else | ticket rule 2, `cards.md` | A re-readable PAN is a real security defect, not a style nit |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal | ticket rule 3, `cards.md` | An unguarded transition lets a cancelled card come back to life |
| `4242` test BIN, valid Luhn digit, generated server-side | ticket rule 4, `cards.md` | A client-generated or non-Luhn number is unshippable by the ticket's own definition |
| Validate on the server against an allowlist before it reaches the store | `CLAUDE.md`, `api-routes.md` | A missing merchant, negative limit, or non-`USD/EUR/GBP` currency lands in the store because the client was trusted |
| Never return a full card number from a list or detail route | `api-routes.md` | Reveal-once is only real if the GET handlers physically cannot emit it |

## Approach

Add a `Card` domain next to the existing ones: a type in `types.ts`, an in-memory array in the store, query/mutation functions in `queries.ts`, two route handlers (`/api/cards`, `/api/cards/[id]`), and two pages (`/cards`, `/cards/[id]`) built from existing components (`Table`, `Drawer`, `Input`, `Select`, `Button`, `Badge`). The issue flow is a `Drawer` form that POSTs, then swaps its own body to a one-time success view holding the full number in local component state only — never written back to the store, never re-fetched.

**Considered and rejected:** issuing via a full `/cards/new` page instead of a drawer. Rejected because nothing else in the console uses a page for a create action, the ticket calls it "a form or dialog," and a drawer keeps the reveal-once screen from ever having a URL that could be revisited (a page could be reloaded, hitting a route with no memory of the number).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `Card` (id, nickname, merchantId, limit, currency, status, last4, spend, createdAt); add `CardFilters` if list needs merchant/status filtering |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store`, initialized empty in `createStore` |
| `src/lib/luhn.ts` | add | `luhnCheckDigit`, `generateCardNumber` (4242 BIN + random digits + check digit), server-only |
| `src/lib/luhn.test.ts` | add | Checksum correctness, BIN prefix, length, determinism of the check digit for a given prefix |
| `src/lib/cardStatus.ts` | add | `canTransition(from, to)` / `nextStatus` guard encoding `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal |
| `src/lib/cardStatus.test.ts` | add | Every legal and illegal transition, especially that nothing leaves `cancelled` |
| `src/data/queries.ts` | change | `parseCardFilters`, `listCards`, `cardById`, `validateCardInput`, `createCard` (generates number, stores last4 + ref, returns full number once), `setCardStatus` (guards via `cardStatus.ts`) |
| `src/app/api/cards/route.ts` | add | `GET` → `listCards`; `POST` → validate, `createCard`, return the one-time payload |
| `src/app/api/cards/[id]/route.ts` | add | `GET` → `cardById` (masked); `PATCH` → `setCardStatus` for freeze/unfreeze, rejecting illegal transitions with a clear status code |
| `src/components/ui/cards/StatusBadge.tsx` | add | Card-status badge (`active/frozen/cancelled`), same shape as the payments one, not a shared edit to it |
| `src/app/cards/page.tsx` | add | List page: table of nickname, merchant, masked number, limit, status, created date; empty and error states |
| `src/app/cards/issue-card-drawer.tsx` | add | `"use client"` — Drawer form (nickname, merchant, limit, currency) → POST → one-time reveal view in local state |
| `src/app/cards/[id]/page.tsx` | add | Detail page: full record, spend-vs-limit bar (amber past 80%), freeze/unfreeze actions |
| `src/app/cards/[id]/status-actions.tsx` | add | `"use client"` — freeze/unfreeze buttons calling `PATCH`, updating the row without a full reload |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add a "Cards" nav entry |
| `src/app/siteConfig.ts` | change | Add `baseLinks.cards = "/cards"` |

## Plan

1. **Types and store** — done when: `Card`/`CardStatus` compile and `store.cards` exists as `[]`, verified by `tsc`/build not erroring.
2. **Luhn helper + tests** — done when: `npm test` passes new `luhn.test.ts` covering checksum validity, `4242` prefix, and fixed length.
3. **Card status helper + tests** — done when: `npm test` passes new `cardStatus.test.ts` covering all six legal/illegal transitions.
4. **Query layer: validation, create, list, detail, status transition** — done when: a manual call (or a quick script) shows `createCard` rejects a missing merchant, a ≤0 limit, a >5,000,000 limit, and a non-allowlisted currency, and accepts a valid input.
5. **Route handlers** — done when: `POST /api/cards` with a valid body returns the full number once; a repeat `GET /api/cards` or `GET /api/cards/[id]` never contains it; invalid bodies return 400 with a safe message.
6. **List page + nav entry** — done when: `/cards` renders the table (empty state with nothing issued yet), and "Cards" appears in the sidebar and routes there.
7. **Issue drawer** — done when: submitting the form adds a row to the list and shows the full number exactly once on a success screen that cannot be reopened to show it again.
8. **Detail page + spend bar + freeze/unfreeze** — done when: opening a card shows the masked number and full record, the bar renders (0% until spend exists) and turns amber past 80%, and freeze/unfreeze updates status in place without a full page reload, refusing the transition once `cancelled`.
9. **`npm test` + `/ship-ready`** — done when: both are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form/dialog | Manual: submit the drawer with valid fields, see the new row in `/cards` |
| Card list at `/cards` | Manual: table shows nickname, merchant, masked number, limit, status, created date |
| Card detail | Manual: open a card, see full record + spend-vs-limit |
| Generated numbers, `4242` BIN, valid Luhn | `luhn.test.ts` + manual read of the one-time reveal string |
| Reveal once, mask forever | Manual: reload `/cards` and open the detail page after creating a card — number never reappears; grep confirms no GET response includes it |
| Server-side validation | Manual: POST with missing merchant, limit `0`, limit `6000000`, currency `"JPY"` each rejected with 400 |
| Freeze/unfreeze without full reload | Manual: click freeze on the list or detail page, confirm status updates via client fetch, not `router.refresh()`-only page reload |
| Spend progress bar, amber past 80% | Manual: inspect bar at 0%, then temporarily bump a card's in-memory `spend` (dev-only check) past 80% of limit and confirm amber |
| Tests: Luhn + status transitions | `npm test` output |

## Risks

- **Spend has no real source.** Nothing in scope produces card transactions, so `spend` is stored as `0` at creation and the progress bar is wired correctly but will only show non-zero once a future ticket adds spend events. Noting this in the PR description rather than fabricating fake transaction data into the store.
- **Card list has no persisted merchant/status filters in the ticket.** Building the list unfiltered first; if time remains, filters follow the existing `PaymentsFilterBar` pattern rather than inventing a new one.

## Out of scope

- Persistence (NWP-203), auth/roles, real card network calls, editing a limit after issue (NWP-202), merchant category lock, and bespoke empty/error copy beyond the core list and detail views — per the ticket and the scoping answer already given.

## Open questions

- None blocking; spend-bar data source above is a documented risk, not an open question.
