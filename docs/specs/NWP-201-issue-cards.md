# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Akshay Mukkavilli
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens 12-20 times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus (Head of Merchant Ops) wants issuance, the card list, and card detail in the console.

## Current state

- `src/data/types.ts` defines `Currency`, `Merchant`, `Payment`, `Dispute`, `Payout` — no `Card` type exists yet.
- `src/data/merchants.ts` — 10 fictional merchants, each with a fixed `currency` (USD/GBP/EUR). Nothing in the console currently checks that a card's currency matches its merchant's currency.
- `src/data/store.ts` — in-memory `Store` held on `globalThis.__northwindStore`, seeded once via `generate()`. No `cards` array yet.
- `src/data/queries.ts` — the one query builder, but it is payment-specific (`filterPayments`/`sortPayments`/`paginate`/`queryPayments`). Cards need their own query module; reusing this one would mean bending payment filters to cards, which is worse than a sibling module.
- `src/lib/money.ts` — `formatMoney`, `formatMoneyCompact`, `parseAmountToMinorUnits`, `sumMinorUnits`. All amounts are integer minor units; use these rather than re-implementing formatting or parsing.
- `src/lib/dates.ts` — has `formatDate`/`formatInZone` (per `src/app/payments/[id]/page.tsx` usage) for UTC storage / merchant-timezone display.
- `src/app/api/payments/route.ts` — the pattern for a route handler: parse+validate params via a `data/` helper, return `NextResponse.json(...)`.
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx` — the list/detail pattern to mirror: server components, `Table*` primitives, `StatusBadge`, empty-state row, `Field` helper for detail `dl`.
- `src/components/ui/payments/StatusBadge.tsx` — a generic status badge keyed by a status union (`PaymentStatus | DisputeStatus | PayoutStatus`). Extending its unions to include `CardStatus` reuses it instead of building a second badge.
- No `Dialog` component exists in `src/components/` yet, despite `.claude/rules/components.md` describing one as already available. `@radix-ui/react-dialog` is an installed dependency (`package.json`) and unused elsewhere — it needs a Tremor-style wrapper (`src/components/Dialog.tsx`), following the pattern already used in `src/components/Select.tsx` (Radix primitive + `tv()`/`cx()` styling).
- `src/components/Sidebar.tsx` / `src/components/ui/navigation/AppSidebar.tsx` / `src/app/siteConfig.ts` — nav items are declared in one array in `AppSidebar.tsx`, keyed off `siteConfig.baseLinks`. Cards needs an entry in both.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md`, `.claude/rules/money.md` | A `$250.00` limit stored as `250` or `"250.00"` corrupts every comparison against it |
| Card numbers generated server-side, `4242` BIN, valid Luhn check digit | `.claude/rules/cards.md`, ticket | A client-generated or hardcoded number is not a real check and is a scored fail |
| Full number revealed exactly once, in the creation response; masked (`•••• 4242`) everywhere else, never persisted | `.claude/rules/cards.md`, `.claude/rules/api-routes.md`, ticket | A card record, list, or detail payload carrying the full PAN is the single worst failure mode for this ticket |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal, guarded server-side | `.claude/rules/cards.md`, ticket | A client-only guard lets a stale tab reactivate a cancelled card |
| Validate on the server against an allowlist; reject early | `.claude/rules/api-routes.md`, `CLAUDE.md` | Client-only checks score at most 0.5 per the grading rubric |
| No database, ORM, or migration; store is in-memory and resets on restart | `CLAUDE.md`, ticket | Out of scope; adding one is a quality failure, not a bonus |

## Approach

Add a `Card` domain type and a sibling in-memory collection (`store.cards`), a dedicated `src/data/cardQueries.ts` for reads/writes (mirroring, not reusing, the payment query builder — the filtering shape is different enough that forcing it through `queries.ts` would be the second-filter-path anti-pattern in the other direction), and a `src/lib/cards.ts` for pure, tested logic: Luhn generation, the status state machine, and spend-percentage math for the progress bar. Two route handlers (`/api/cards`, `/api/cards/[id]`) do all validation and are the only place a full number is ever returned. UI mirrors the existing payments list/detail split, adding an issue dialog (built on a new `Dialog` primitive) and client-side freeze/unfreeze/cancel actions that update local state without a full reload.

Two things the ticket doesn't spell out, built because the codebase already knows about them:
- **Currency must match the merchant.** `src/data/merchants.ts` fixes each merchant's currency. The form derives currency from the chosen merchant (read-only in the UI); the server independently re-checks `limit currency === merchant.currency`, not just membership in `{USD, EUR, GBP}`.
- **Idempotent issue.** A double-click or retried submit must not mint two cards. The client generates a `requestId` (UUID) once per form open; the server stores it on the card and returns the existing card on a repeat rather than creating a duplicate.

**Considered and rejected:** Putting card filtering through `queries.ts`'s generic builder. Rejected because `PaymentFilters`/`filterPayments` are shaped around payment fields (status enum, merchant, date range, text search across payment-specific columns); forcing cards through it would mean widening a payment-specific builder with card-only branches, which is the same "second implementation" smell the rule warns about, just inverted. A small sibling module with the same shape (`parse → filter/sort → paginate`) is simpler.

**Considered and rejected:** Deriving `spent` from existing seeded payments (e.g. summing a merchant's card-method payments). Rejected: none of the seeded data links to card numbers we generate, so any link would be fabricated. Simpler and honest: `spent` is `0` at issue and stays `0` until this store gets a way to actually charge a card (out of scope here) — the progress bar renders that truthfully, and its amber-at-80% logic is unit-tested against synthetic inputs rather than demoed against fake spend.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Add `CardStatus`, `CardCategory`, `Card`, `CardStatusEvent` | Domain type, no `Card` today |
| `src/data/store.ts` | Add `cards: Card[]` to `Store`, init `[]` | New collection, in-memory only |
| `src/data/cardQueries.ts` | New | List/create/get/transition, validation, idempotency — the one place cards touch the store |
| `src/lib/cards.ts` | New | Luhn digit, `generateCardNumber`, `canTransition`, `spendPercentage`/`isNearLimit` — pure, testable |
| `src/lib/cards.test.ts` | New | Unit tests: Luhn validity + BIN prefix, state-machine transitions, spend-percentage thresholds |
| `src/app/api/cards/route.ts` | New | `GET` (list, masked), `POST` (validate, generate, reveal once) |
| `src/app/api/cards/[id]/route.ts` | New | `GET` (detail, masked), `PATCH` (guarded status transition) |
| `src/components/Dialog.tsx` | New | Tremor-style wrapper over `@radix-ui/react-dialog`, reused by the issue dialog and cancel confirmation |
| `src/components/ui/payments/StatusBadge.tsx` | Extend unions | Reuse the existing badge for `CardStatus` instead of a second one |
| `src/components/ui/cards/SpendProgressBar.tsx` | New | Renders `spendPercentage`/`isNearLimit` from `src/lib/cards.ts`; amber past 80% |
| `src/app/cards/page.tsx` | New | Server component: list, empty state |
| `src/app/cards/cards-table.tsx` | New | Client component: rows, freeze/unfreeze/cancel without reload |
| `src/app/cards/issue-card-dialog.tsx` | New | Client component: issue form, currency locked to merchant, reveal-once success view |
| `src/app/cards/[id]/page.tsx` | New | Server component: full record, spend bar, audit trail |
| `src/app/cards/[id]/card-actions.tsx` | New | Client component: freeze/unfreeze/cancel-with-confirm on detail |
| `src/app/siteConfig.ts` | Add `baseLinks.cards` | Nav needs a route constant |
| `src/components/ui/navigation/AppSidebar.tsx` | Add nav entry | Cards needs to be reachable from the sidebar |

## Plan

1. **Types + store + lib** — done when `src/data/types.ts` has `Card`, `store.cards` exists, `src/lib/cards.ts` generates a Luhn-valid `4242…` number and enforces the state machine, and `npm test` covers both.
2. **API routes** — done when `POST /api/cards` rejects missing merchant, non-positive limit, limit over 5,000,000, non-allowlisted currency, and merchant/currency mismatch; returns the full number exactly once; `GET` routes never include it; `PATCH` rejects transitions out of `cancelled`.
3. **List + issue flow** — done when `/cards` renders the seeded-empty list with a written empty state, "Issue card" opens the dialog, submitting shows the reveal-once success screen, and the new card appears in the list without a manual refresh.
4. **Detail + actions** — done when `/cards/[id]` shows the masked number, spend bar, category, and audit trail, and freeze/unfreeze/cancel work from both the list and detail without a full page reload.
5. **Polish pass** — done when `npm test` is green, `/ship-ready` passes, and the stretch items actually built are named accurately in the PR.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Manual: fill the dialog, submit, see it in the list |
| Card list fields | Manual: `/cards` shows nickname, merchant, masked number, limit, status, created date |
| Card detail | Manual: open a card, see full record + spend bar |
| Generated numbers, Luhn, `4242` | `src/lib/cards.test.ts` |
| Reveal once / mask forever | Manual: success screen shows the number once; list/detail/API responses afterward show `•••• 4242` only |
| Server-side validation | `src/lib/cards.test.ts` + manual: hit `POST /api/cards` with a bad payload, confirm 4xx with a safe message |
| Status transitions | `src/lib/cards.test.ts` (`canTransition`) + manual: cancel a card, confirm freeze/unfreeze no longer offered |

## Risks

- No `Dialog` primitive exists despite the rule file implying one; building it adds surface area. Mitigated by keeping it a thin Radix wrapper matching `Select.tsx`'s style, not a new design system.
- Idempotency and currency-matching are unscoped by the ticket; keeping both small and additive (a header/body field, a derived read-only form field) avoids scope creep into persistence or auth, which are explicitly out.

## Out of scope

- Persistence, auth, real card network calls, editing a limit after issue — per the ticket, unchanged here.
- Deriving real spend from payments — no real linkage exists in seed data; would be fabricated.

## Open questions

- None blocking; if a merchant's currency ever needs to differ from the card's (e.g. multi-currency merchants), that is a future ticket, not this one.
