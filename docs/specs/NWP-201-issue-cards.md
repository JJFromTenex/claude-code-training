# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** beidoylefamily@gmail.com
**Status:** draft

## Problem

Ops cannot issue a virtual card themselves. They message the platform team, who hand-create each card, which takes hours and happens 12–20 times a week. Last month two cards went out with the wrong spend limit because the limit was retyped by a human in a chat thread. Cards are always single-merchant, always virtual, and always need a limit at creation — so the whole job is one form, and it belongs in the console.

## Current state

- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"`, `Merchant { id, name, country, timezone, currency, riskTier }`, and the existing entities (`Payment`, `Refund`, `Dispute`, `Payout`). Every one is a flat interface with `amount` as integer minor units and `createdAt` as an ISO 8601 UTC string. **There is no `Card` type** — it must be added here, following that shape.
- `src/data/store.ts` — in-memory store held on `globalThis.__northwindStore` so hot reload does not wipe it. The `Store` interface has `merchants, payments, refunds, disputes, payouts`; `createStore()` calls `generate()` from `src/data/generate.ts` and merges in `merchants`. No `cards`.
- `src/data/merchants.ts` — `merchants: Merchant[]` (10 fictional merchants) and `merchantById(id)`. This is both the dropdown source and the server-side "merchant exists" check.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` and `parseAmountToMinorUnits(input: string)`. Both already exist; no new formatter or parser is to be written.
- `src/lib/dates.ts` — `formatDate(iso)` for tables, `formatInZone(iso, timeZone)` for merchant-local detail views.
- `src/data/queries.ts` + `src/app/api/payments/route.ts` — `parseFilters(searchParams)` validates every client param against an allowlist before use; `queryPayments()` composes filter/sort/paginate. Cards needs no filtering in core scope, but the allowlist-first habit carries over to the POST body and any PATCH status.
- Every existing API route is **read-only**. `POST /api/cards` is the first write route in this codebase, so there is no write handler to copy — the pattern is: thin `export async function POST(request: NextRequest)`, validate, mutate `store.cards` directly, return `NextResponse.json(...)` with a real status code and a safe message (`.claude/rules/api-routes.md`).
- `src/components/` (Tremor + Radix, Tailwind only) — `Button` (`primary|secondary|light|ghost|destructive`, `isLoading`), `Input`, `Select*`, `Badge`, `Table*`, and `Drawer*` (Radix Dialog underneath). **There is no `Dialog` component** — `Drawer` is the modal primitive for the issue form.
- `src/components/ui/payments/StatusBadge.tsx` — maps a status union to label + color + dot. The card badge copies this exactly.
- Page shapes to mirror: `src/app/payouts/page.tsx` (list: server component reading `store` straight, `Table`), `src/app/payments/[id]/page.tsx` (detail: async server component, `notFound()`, `<dl>` grid, `Divider`), `src/app/payments/filter-bar.tsx` (the `"use client"` + `router` pattern).
- `src/app/siteConfig.ts` — `baseLinks: { overview, payments, disputes, payouts }`. `src/components/ui/navigation/AppSidebar.tsx` — `navigation` array of `{name, href, icon, notifications}`; `House, CreditCard, ShieldAlert, Banknote` from `lucide-react` are already taken.
- Tests: Vitest, node env, no DOM (`vitest.config.ts`). Tests sit beside their code (`src/lib/money.test.ts`, `src/lib/dates.test.ts`).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Test BIN only. Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | A number that could resemble real card data ships from a training repo |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The client can choose its own PAN; generation is not trustworthy |
| "Reveal once. The full number appears in the creation response and nowhere else." | `.claude/rules/cards.md` | Full PANs leak through list/detail payloads forever |
| "Mask everywhere else as `•••• 4242`." | `.claude/rules/cards.md` | Inconsistent masking makes a leak invisible in review |
| "Never return a full card number from a list or detail route." | `.claude/rules/api-routes.md` | Same leak, via the API rather than the UI |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card gets reactivated by a crafted request |
| "Amounts are integer minor units. Never store, compare, or accumulate an amount as a float." | `.claude/rules/money.md`, `CLAUDE.md` | Limits drift by cents — the exact failure the ticket reports |
| "Validate everything from the client against an allowlist before it reaches the store." | `.claude/rules/api-routes.md` | Bad merchant/currency/limit lands in the store; client is not trusted |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | The one screen ops uses 20x/week is not keyboard-usable |
| "Write the empty and error states." | `.claude/rules/components.md` | `/cards` is empty on every dev restart and looks broken |

## Approach

Cards becomes the first writable resource. A new `src/lib/cards.ts` owns all card logic as pure functions — `generateCardNumber()` (16 digits: `4242` BIN + 11 random digits + a computed Luhn check digit), `luhnCheckDigit(digits)`, `maskCardNumber(last4)` → `•••• 4242`-style display string, and `isValidStatusTransition(from, to)` encoding `active ⇄ frozen`, either `→ cancelled`, `cancelled` terminal. Because it is pure and node-only, it is unit-testable under the existing Vitest config with no DOM. `Card` is added to `src/data/types.ts` as a flat interface: `id, nickname, merchantId, last4, spendLimit (integer minor units), currency, status: CardStatus, spent (integer minor units), createdAt (ISO UTC)`, plus optional `categoryLock` for the stretch goal. `spent` starts at `0` and never changes — **a deliberate simplification: there is no transaction system and real card network calls are out of scope**, so "spend against the limit" renders `spent` vs `spendLimit` from a field that is currently always zero. `store.cards: Card[]` starts empty (ops creates cards live; nothing is seeded).

Four routes, all thin: `POST /api/cards` validates the body against allowlists (merchant must resolve via `merchantById`, currency must be one of `USD|EUR|GBP`, limit must be an integer `> 0` and `<= 5_000_000`, nickname non-empty), generates the number server-side, stores **only** `last4` plus the card record, and returns the created card **plus a one-time `fullNumber` field**. `GET /api/cards` returns all cards newest-first; `GET /api/cards/[id]` returns one or 404 — neither ever includes a full number. `PATCH /api/cards/[id]` (stretch) takes `{ status }`, checks it through `isValidStatusTransition`, and returns 400 on an illegal move. The UI is two server components (`/cards` list, `/cards/[id]` detail) reading `store` directly, plus a `"use client"` `Drawer` form that POSTs and then renders the full number once on an in-drawer success screen — the full number lives only in that component's React state and is never written to the store or re-fetched.

**Considered and rejected:** returning the full number from `GET /api/cards/[id]` behind a `?reveal=1` flag so the detail page could show it on demand. Rejected because it requires persisting the full PAN, which `.claude/rules/cards.md` forbids outright, and "reveal once" then becomes unenforceable. Also rejected: a separate `/cards/new` route instead of a `Drawer` — the codebase has no page-level form precedent, `Drawer` is the existing Radix-backed modal, and a full-page navigation would make the post-create reveal a URL that could be revisited.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | Add `CardStatus = "active" \| "frozen" \| "cancelled"` and the `Card` interface |
| `src/data/store.ts` | Change | Add `cards: Card[]` to `Store`, initialize `[]` in `createStore()` (not seeded) |
| `src/lib/cards.ts` | Add | `generateCardNumber()`, `luhnCheckDigit()`, `maskCardNumber()`, `isValidStatusTransition()` — server-side, pure |
| `src/lib/cards.test.ts` | Add | Vitest: `4242` prefix, 16 digits, Luhn validity over many samples, every legal/illegal transition |
| `src/app/api/cards/route.ts` | Add | `POST` (validate + create + one-time `fullNumber`) and `GET` (list, newest first, masked) |
| `src/app/api/cards/[id]/route.ts` | Add | `GET` one card (404 if missing); `PATCH` status with server-side transition guard (stretch) |
| `src/app/cards/page.tsx` | Add | List page: server component, `Table` of nickname / merchant / masked number / limit / status / created; written empty state |
| `src/app/cards/[id]/page.tsx` | Add | Detail page: `notFound()`, `<dl>` field grid, spend vs limit, merchant-local created time |
| `src/app/cards/issue-card-drawer.tsx` | Add | `"use client"` `Drawer` form (nickname, merchant `Select`, limit via `parseAmountToMinorUnits`, currency `Select`) + the reveal-once success screen |
| `src/components/ui/cards/CardStatusBadge.tsx` | Add | Mirrors `StatusBadge.tsx`: active=success, frozen=default/neutral, cancelled=error |
| `src/app/siteConfig.ts` | Change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | Change | Add the Cards nav entry (`Wallet` from `lucide-react`; `CreditCard` is taken by Payments) |

## Plan

Sequenced so each step ends somewhere verifiable. Steps 1–8 are the whole core score; do not start step 9 until they are all solid.

1. **Types + store** — add `CardStatus`, `Card`, `Store.cards`, `cards: []` in `createStore()`. Done when: `npx tsc --noEmit` is clean and `store.cards` exists as an empty array.
2. **`src/lib/cards.ts` + its test** — Luhn check digit, 16-digit `4242` generator, mask helper, transition guard. Done when: `npm test` passes, including a loop asserting 1000 generated numbers all start `4242`, are 16 digits, and pass an independent Luhn validation.
3. **`POST /api/cards`** — allowlist validation (merchant exists, currency in set, integer limit in `1..5_000_000`, nickname present), server-side generation, push to `store.cards`, return 201 with the card plus one-time `fullNumber`. Done when: a valid POST returns a card whose `last4` matches the returned `fullNumber`, and each invalid case (missing merchant, limit `0`, limit `-1`, limit `5_000_001`, currency `JPY`) returns 400 with a safe message.
4. **`GET /api/cards` and `GET /api/cards/[id]`** — list newest-first, detail or 404. Done when: both return the cards created in step 3, neither response body contains a full card number anywhere, and an unknown id returns 404.
5. **`/cards` list page + `CardStatusBadge`** — server component `Table` with the six required columns and a written empty state. Done when: `/cards` renders the created cards with masked numbers and `formatMoney` limits, and shows the empty-state copy on a fresh dev server.
6. **Issue-card `Drawer` + reveal-once success screen** — labelled inputs, `parseAmountToMinorUnits` at the boundary, server errors surfaced inline, success screen shows the full number exactly once with a "you will not see this again" line. Done when: submitting from `/cards` creates a card, the full number appears on the success screen, and closing and reopening the drawer or reloading `/cards` shows only `•••• ****`.
7. **`/cards/[id]` detail page** — full record via `<dl>`, `notFound()` on unknown id, spend shown as `formatMoney(spent)` of `formatMoney(spendLimit)`, created time via `formatInZone` with the merchant's timezone. Done when: clicking a row from the list lands on a populated detail page and a bogus id 404s.
8. **Nav** — `siteConfig.baseLinks.cards` + the sidebar entry. Done when: Cards appears in the sidebar and highlights on `/cards`.
9. **Stretch, only if time remains, in this order** — (a) `PATCH /api/cards/[id]` guarded by `isValidStatusTransition`, called from a client freeze/unfreeze control in the list with `router.refresh()` so there is no full page reload; (b) spend progress bar on detail, amber past 80%; (c) merchant category lock chosen at issue time and shown on the card; (d) transition tests in `cards.test.ts`; (e) written error states on both pages. Done when: each lands independently with `npm test` still green.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form; it appears in the list | Submit the drawer on `/cards`; the new row is present after the refresh (Plan 6) |
| `/cards` shows nickname, merchant, masked number, limit, status, created | Visual check of the `Table` columns on `/cards` (Plan 5) |
| Card detail shows full record and spend against limit | `/cards/[id]` `<dl>` plus the `spent` / `spendLimit` line (Plan 7) |
| Numbers generated server-side, `4242` BIN, valid Luhn | `src/lib/cards.test.ts` over 1000 samples; generation exists only in the route/lib, never in a `"use client"` file (Plan 2–3) |
| Reveal once, mask forever | Success screen shows it once; `GET` list and detail bodies grepped for a 16-digit sequence — none present (Plan 4, 6) |
| Server-side validation rejects bad merchant / limit / currency | Five explicit 400 cases against `POST /api/cards` with the client bypassed (Plan 3) |
| Money stays integer minor units | `parseAmountToMinorUnits` at the form boundary only; `spendLimit`/`spent` typed `number` and asserted integer in the route (Plan 3) |
| Status transitions guarded server-side | `isValidStatusTransition` unit tests + a `PATCH` attempting `cancelled → active` returning 400 (Plan 9a) |

## Risks

- **`spent` is always `0`.** The progress display and the amber-past-80% stretch goal cannot be demonstrated with real data. Mitigation: build the display to read `spent`, keep the field in the type, and state the simplification in the PR description rather than faking a transaction.
- **Full number leaking into the store or a log.** Mitigation: `generateCardNumber()` returns the number to the route handler only; the route derives `last4`, stores the card without the full number, and the full number exists solely in the POST response body and the drawer's React state. Never `console.log` it.
- **Hot-reload store identity.** `globalThis.__northwindStore` survives reload, but cards still vanish on a real dev-server restart — expected (persistence is out of scope). The empty state must read as normal, not as an error.
- **First write route in the codebase.** No precedent to copy, so it is easy to drift from `.claude/rules/api-routes.md`. Mitigation: keep the handler thin, validate first, return real status codes, and put every reusable decision in `src/lib/cards.ts`.

## Out of scope

- Persistence, database, ORM, migrations — in-memory `store.cards` only; it resets on dev-server restart.
- Auth, roles, permissions — any signed-in user can issue a card.
- Real card network calls — hence `spent` never moves off `0`.
- Editing a spend limit after issue — no `PUT`/limit `PATCH`; the only mutable field is `status`.
- Filtering, sorting, pagination on `/cards` — the list is all cards, newest first. `parseFilters()` in `src/data/queries.ts` is the place for it later.

## Open questions

- **Card number length.** The rules pin the `4242` BIN and a valid Luhn check digit but not the total length. **Recommendation: 16 digits** (`4242` + 11 random + 1 check digit), matching real Visa test-BIN convention and the `•••• 4242` mask shape. Flag before building if a different length is wanted.
- **Cancelled badge color.** `.claude/rules/cards.md` does not say. **Recommendation: neutral gray** for `cancelled` (terminal, not an error) and reserve red for nothing in this set; `frozen` takes the blue/default. Consistent with how `StatusBadge.tsx` uses color for state rather than severity.
- **Does the masked display use the real last four or the literal `4242`?** The rule text says mask as `•••• 4242`, which reads as an example. **Recommendation: mask with the card's real `last4`** (`•••• 7391`), since that is what makes the column useful to ops and `last4` is explicitly the field we store. Flag if the literal string was meant.
