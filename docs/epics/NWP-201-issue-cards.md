# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Jack
**Status:** reviewed

## Problem

Ops issues 12-20 virtual cards a week by messaging the platform team, who create them by hand from a Slack thread. That's hours of turnaround, and last month two cards shipped with the wrong spend limit because the request lived in chat instead of a form. Marcus wants ops able to issue, list, and inspect a card themselves, today.

## Current state

There is no card domain in this codebase yet — this is new, not a change.

- `src/data/types.ts` — has `Currency` (`"USD" | "EUR" | "GBP"`, already exactly the ticket's allowed set), `Merchant`, `Payment`, and friends. No `Card` type.
- `src/data/store.ts:15-24` — `Store` interface and `createStore()`. Adding `cards: Card[]` here, starting empty (`[]`), is the only store change; no seed data, since ops hasn't issued anything yet.
- `src/data/queries.ts` — the payments query builder (`filterPayments`/`sortPayments`/`paginate`/`queryPayments`) and `parseFilters`. Pattern to mirror for cards, not reuse directly — different domain, own module.
- `src/app/api/payments/route.ts` and `src/app/api/payments/export/route.ts` — thin route handlers that parse+validate params, call the query/lib layer, return `NextResponse.json(...)`. This is the shape card routes will follow.
- `src/app/payments/page.tsx` (server component, calls `queryPayments` directly — no `fetch` from a server component) and `src/app/payments/[id]/page.tsx` (detail page, `notFound()` on miss) — the list/detail pattern to mirror for `/cards` and `/cards/[id]`.
- `src/app/payments/export-dialog.tsx` — the one existing "use client" dialog built on `src/components/Drawer.tsx` (Radix Dialog underneath). This is the only interactive-dialog precedent in the app; the issue-card flow reuses this shape.
- `src/lib/money.ts` — `formatMoney`, `parseAmountToMinorUnits` (dollar-string → minor units, boundary-only). Reuse both; do not write a second money parser.
- `src/lib/dates.ts` — `formatDate` (UTC, for tables). Reuse for `createdAt`.
- `src/components/ui/payments/StatusBadge.tsx` — badge-by-status pattern (label + dot + Badge variant maps, keyed by status union). Card status gets its own small version of this, not a shared one — `PaymentStatus`/`DisputeStatus`/`PayoutStatus`/`CardStatus` don't overlap in meaning even where a string collides.
- No `ProgressBar`/`Checkbox`/`RadioGroup` component exists (confirmed in `src/components/`). The spend-progress bar (stretch) is hand-rolled Tailwind, same call NWP-101 made for the export dialog's checkboxes — nothing to reuse, so rolling one is not a violation of "use what's here."
- `src/app/siteConfig.ts` and `src/components/ui/navigation/AppSidebar.tsx` — nav entries for Overview/Payments/Disputes/Payouts. `/cards` is a new top-level route; adding it here is a two-line change, same shape as the existing four.
- `src/data/generate.ts:65` has a `pad(n, width)` helper for sequential ids (`pay_000001`). Cards get the same shape, `card_000001`, computed from `store.cards.length` at creation time (store persists across hot reload via `globalThis`, so this is safe — no separate counter to lose).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units | `CLAUDE.md`, `.claude/rules/money.md`, ticket rule 1 | A $250.00 limit stored as `250` or `"250.00"` silently changes meaning everywhere it's compared |
| Never persist or display a full card number after creation | ticket rule 2, `.claude/rules/cards.md` | A card record with a `number` field is a live PAN sitting in memory, returned by every list/detail fetch forever |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal | ticket rule 3, `.claude/rules/cards.md` | An unguarded PATCH lets a cancelled card come back to life, or a frozen card skip straight to double-charging |
| `4242` BIN, valid Luhn, generated server-side | ticket rule 4, `.claude/rules/cards.md` | A client-generated or non-Luhn number is either a bug or, worse, something that could be mistaken for a real PAN |
| Validate everything from the client against an allowlist before it reaches the store | `.claude/rules/api-routes.md` | A merchant id, currency, or limit that isn't checked server-side means the client's guardrails are the only guardrails |
| Never return a full card number from a list or detail route | `.claude/rules/api-routes.md` | Same failure as rule 2, at the route layer instead of the type layer |

## Approach

Add a `Card` domain that mirrors the existing payments domain's shape exactly: a type in `types.ts`, an empty array on the store, a small pure-logic module in `src/lib/cards.ts` (Luhn generation/validation, status-transition guard, input validation — all pure, all testable without the store), a store-touching query module in `src/data/cardQueries.ts` (create/list/get/update-status), thin route handlers under `src/app/api/cards/`, and server-component pages at `/cards` and `/cards/[id]` with small client islands only where interaction requires it (the issue dialog, and a status control for freeze/unfreeze/cancel). The full number exists only as a local variable inside the create call and the one JSON response it's returned in — the `Card` type never has a field for it, so "never persist it" is enforced by the type, not by remembering to strip it.

**Considered and rejected:** generating the card number in the issue dialog (client) and posting it to the server to store. Rejected outright — it's explicitly the bug the ticket rules call out ("Generate on the server. A card number produced in the browser is a bug"), and it would mean the number transits the network twice instead of once.

**Considered and rejected:** seeding a handful of fake issued cards at boot, the way payments/disputes/payouts are seeded. Rejected — ops hasn't issued anything yet in this story, so an empty `/cards` on first load is correct, not a gap, and it's the natural home for the written empty-state stretch goal instead of a fabricated one.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `MerchantCategory`, `Card` |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store`, start empty |
| `src/lib/cards.ts` | add | Luhn generate/validate, `canTransition`, input validation — pure, no store access |
| `src/lib/cards.test.ts` | add | Luhn (BIN, length, check digit) + status-transition tests — the named stretch goal |
| `src/data/cardQueries.ts` | add | `listCards`, `cardById`, `createCard`, `updateCardStatus` — store access, calls into `lib/cards.ts` |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` create (validates, generates, returns `{ card, number }` once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, `PATCH` status change (guarded by `canTransition`) |
| `src/app/cards/page.tsx` | add | List page: table + empty state + "Issue card" trigger |
| `src/app/cards/issue-card-dialog.tsx` | add | Client: form → success screen (one-time reveal) |
| `src/app/cards/[id]/page.tsx` | add | Detail page: full record, spend progress (stretch) |
| `src/app/cards/card-status-control.tsx` | add | Client: freeze/unfreeze/cancel, shared by list row + detail, no page reload |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Status → label/dot/variant, mirrors `StatusBadge` shape |
| `src/components/ProgressBar.tsx` | add | Hand-rolled, Tailwind-only; amber past 80% (stretch) |
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | change | Add `/cards` nav entry |

## Plan

1. **Types + store** — `Card`, `CardStatus`, `MerchantCategory` added; `store.cards` exists and starts empty. Done when: `npm run build` still passes (nothing references it yet).
2. **`src/lib/cards.ts` + tests** — Luhn generator/validator, `canTransition`, `validateCreateCardInput`. Done when: `npm test` is green with the new cases (generated numbers start `4242`, are 16 digits, pass Luhn; every legal/illegal transition is asserted).
3. **`src/data/cardQueries.ts` + API routes** — create/list/get/status-update wired to the store. Done when: `curl` against a running dev server proves creation returns the full number exactly once, list/detail never do, and each of the six invalid-input cases from the ticket returns 400.
4. **List + detail pages** — server-rendered, masked, empty state written. Done when: the pages build and render with zero cards, and with cards present after a manual create.
5. **Issue dialog** — form → POST → one-time reveal screen, list updates after close. Done when: creating a card end-to-end (curl-verified route + read-verified component logic) shows the full number once and never again.
6. **Status control + progress bar (stretch)** — freeze/unfreeze/cancel without a reload; spend bar turns amber ≥80%. Done when: a PATCH round-trip is curl-verified and the component's rendering logic is read-verified.
7. **Nav entry, `/ship-ready`, `/northwind-pr`.**

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form; appears in the list | `curl -X POST /api/cards` creates it; `curl /api/cards` lists it. Dialog wiring read-verified (no browser click-through this session, same caveat as NWP-101). |
| `/cards` list: nickname, merchant, masked number, spend limit, status, created date | Page code read-verified against `Card` fields; route-level data curl-verified. |
| Card detail: full record + spend vs. limit | Same — route + page code. |
| Numbers generated server-side, `4242` BIN, valid Luhn | Unit tests in `cards.test.ts`; route never accepts a client-supplied number. |
| Reveal once, mask forever | `Card` type has no number field, only `last4`; POST response is the only place `number` appears — grep the diff for it after building. |
| Server-side validation (missing merchant, ≤0 limit, >5,000,000, bad currency) | `curl` with each of the four bad-input shapes, expect 400. |

## Risks

- No real spend data exists (out of scope: real card network calls), so every new card's `spent` starts at `0`. The progress bar is real and correct, but nothing will visibly cross 80% without a manual edit to test it — noted in the PR rather than faked with seed data.
- Time pressure (this is the Build Battle ticket) is real; if something has to be cut, it's a stretch goal, never a core criterion or a rule in "Domain rules" above.

## Out of scope

- Persistence, auth, real card-network calls, editing a limit after issue — per the ticket, not touched.
- Pagination on `/cards` — ops issues 12-20 cards a week; an unpaginated list is proportionate and the ticket doesn't ask for it. Revisit if that stops being true.

## Open questions

- None that change the shape of the work. Category lock's exact category list isn't specified beyond the ticket's three examples (vendor subscriptions, ad spend, contractor tools) — using those plus "other," open to renaming.
