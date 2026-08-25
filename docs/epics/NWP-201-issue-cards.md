# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** preethir903
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants the whole loop — issue, list, inspect — inside the console.

## Current state

Cards do not exist in this codebase. There is no `Card` type, no card store, no `/cards` route, no card API, and no card-number generator anywhere. This is a new vertical slice, not a modification.

- `src/data/types.ts` — `Currency`, `Merchant`, `Payment`, `Dispute`, `Payout`. `Payment` is the shape to copy: integer minor-unit `amount`, a `currency` code beside it, ISO-8601 UTC `createdAt`, a closed string union for status, `merchantId` as the foreign key, and `last4` stored as its own field.
- `src/data/store.ts` — a plain mutable object pinned to `globalThis.__northwindStore`, built once by `createStore()`. Has `merchants, payments, refunds, disputes, payouts`; no `cards`.
- `src/data/merchants.ts` — ten fixed merchants, each with a home `currency` and a `timezone`. No category field.
- `src/data/queries.ts` — the one payment query builder (`parseFilters`, `filterPayments`, `sortPayments`, `paginate`, `queryPayments`, `paymentById`). Typed to `Payment`; cards get their own small module rather than being forced through it.
- `src/lib/money.ts` — `formatMoney`, `formatMoneyCompact`, `sumMinorUnits`, `parseAmountToMinorUnits`. The last one is the designated boundary parser for a typed spend limit.
- `src/lib/dates.ts` — `formatDate`, `formatInZone` for display; storage stays UTC.
- `src/app/api/payments/route.ts` and `.../export/route.ts` are the only route handlers, both `GET`-only. **There is no existing mutation route**, so `api-routes.md`'s "return the same error shape everywhere" has no precedent to copy — this epic defines it.
- `src/components/` — `Table`, `Drawer` (Radix dialog as a side panel), `Input`, `Select`, `Button`, `Badge`, `Divider`. **`.claude/rules/components.md` claims a `Dialog` component exists; it does not.** `Drawer.tsx` is the working Radix dialog and is what the issue form uses.
- `src/components/ui/payments/StatusBadge.tsx` — typed `Record<PaymentStatus | DisputeStatus | PayoutStatus, …>`, exhaustive and closed.
- `src/lib/*.test.ts` — vitest, `environment: "node"`, `include: ["src/**/*.test.ts"]`. `.test.tsx` is **not** collected, so only pure logic is testable here.
- Known bug, not to be copied: `sortPayments` compares amounts with `String(a.amount).localeCompare(...)`, a lexicographic sort of numbers.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | Cents drift; a $250 limit becomes $2.50 or $25,000 |
| "Format at the edge, in the component that renders it, and nowhere else." | `.claude/rules/money.md` | Two formatters disagree; `src/lib/utils.ts`'s `formatters.currency` is for charts and must not touch cards |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | The repo ships something resembling a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The number is guessable and leaks into client bundles |
| "Reveal once… not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | A full PAN becomes re-readable, which is the whole thing this rule exists to stop |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Validate on the server… checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` | A curl bypasses every limit the form enforces |

## Approach

A self-contained vertical slice that mirrors the payments slice's structure. Types go into `src/data/types.ts` beside `Payment`; the store gains a `cards` array. A new `src/data/cards.ts` holds the small read/write surface (`allCards`, `cardById`, `addCard`, `setCardStatus`) and is the single home of the state-machine guard, so the route handler decides nothing about legality. A new `src/lib/cardNumber.ts` generates a 16-digit `4242`-BIN number with a computed Luhn check digit and returns `{ full, last4 }`; only `addCard` calls it, and `addCard` returns the full number **as a separate value from the stored record** — `Card` has no field to hold one, so a leak would have to be written deliberately. `POST /api/cards` is the only response in the app that carries it. Pages are Server Components reading the data layer directly, exactly like `payments/page.tsx`; the issue form and the freeze toggle are the only `"use client"` files, and they refresh via `router.refresh()` rather than duplicating list state.

**Considered and rejected:** routing cards through `src/data/queries.ts` to honour "one query builder". That builder is typed to `Payment` and exists to stop a *second payment filter path*; cards need no filtering or pagination in this ticket, and widening it to a generic would be a bigger, riskier change than four small card functions. Also rejected: widening `StatusBadge`'s exhaustive `Record`s to include `CardStatus` — that couples payments/disputes/payouts to the card state machine for no shared behaviour. A parallel `CardStatusBadge` reusing the same `Badge` primitive is a few lines and zero coupling.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`, modelled on `Payment` |
| `src/data/store.ts` | change | `cards: Card[]` on the store, seeded with a few demo cards |
| `src/data/cards.ts` | add | `allCards`, `cardById`, `addCard`, `setCardStatus` — the state machine lives here |
| `src/lib/cardNumber.ts` | add | Luhn generator and verifier on the `4242` BIN, server-only |
| `src/lib/cardNumber.test.ts` | add | Proves the BIN prefix, the length, and the check digit |
| `src/data/cards.test.ts` | add | Proves every legal and illegal status transition |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` create with all server-side validation |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, `PATCH` status transition |
| `src/app/cards/page.tsx` | add | The `/cards` list, with a written empty state |
| `src/app/cards/[id]/page.tsx` | add | Card detail with spend against the limit |
| `src/app/cards/issue-card-drawer.tsx` | add | `"use client"` issue form and the one-time reveal screen |
| `src/app/cards/card-actions.tsx` | add | `"use client"` freeze/unfreeze/cancel without a reload |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Card status pill, parallel to `StatusBadge` |
| `src/components/ui/cards/MaskedCardNumber.tsx` | add | `•••• 4242` defined in exactly one place |
| `src/components/ui/cards/SpendProgressBar.tsx` | add | Spend against limit, amber past 80% |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | `/cards` is unreachable without a nav entry |

## Plan

Sequenced so each step ends somewhere verifiable. Server first; no dialog exists until the route is proven.

1. **Types and store** — done when: `cards` is on the store, typechecks, and the seed cards carry `4242` last-fours and minor-unit limits.
2. **Luhn generator plus its test** — done when: `npm test` passes and asserts every generated number starts `4242`, is 16 digits, and satisfies `isValidLuhn`.
3. **`src/data/cards.ts` plus the transition test** — done when: `npm test` proves `active→frozen→active`, both paths to `cancelled`, and that `cancelled` moves nowhere.
4. **API routes** — done when: `POST /api/cards` returns `201 { card, fullNumber }` and each of the five rejection cases returns `400 { error }`.
5. **Verify the server by curl before any UI** — done when: the transcript in the PR shows a valid creation, all five rejections, a freeze, an unfreeze, a cancel, and a `409` on a post-cancel transition.
6. **Read the diff** — done when: money is integer minor units end to end, validation is server-side, `Card` has no full-number field, and no helper was reimplemented.
7. **UI: nav link, list, detail, issue drawer with the one-time reveal** — done when: a card issued in the browser appears in the list, its number shows once, and the detail page shows `•••• last4`.
8. **Stretch, in order** — freeze/unfreeze without a reload, spend progress bar amber past 80%, category lock at issue time. Empty and error copy is written as each screen is built, not batched at the end.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card, appears in the list | Fill the drawer in the browser, submit, see the new row at `/cards` |
| `/cards` list shows all six columns | Screenshot of the table |
| Card detail shows the record and spend against the limit | Open a card; the page renders limit, spent, and the progress bar |
| Numbers are server-side, `4242` BIN, valid Luhn | `npm test` — `src/lib/cardNumber.test.ts` |
| Reveal once, mask forever | `curl GET /api/cards` and `/api/cards/[id]` contain no full number; `Card` has no field for one; the drawer clears reveal state on close |
| Server-side validation | `curl` each of the five rejections and read the `400 { error }` |
| Freeze/unfreeze without a reload | Click freeze in the list; the badge changes with no navigation |
| Status transitions guarded | `npm test` — `src/data/cards.test.ts`; plus a `409` from curl on a cancelled card |
| Spend bar turns amber past 80% | A seeded card above 80% renders amber; one below renders the base colour |
| Empty and error states | Load `/cards` with an empty store; submit the form with a bad limit |

## Risks

- **Full-number leak.** Mitigated structurally: `Card` has no full-number field, so a leak requires deliberately adding one to a response. The reveal value lives only in the drawer's local state and is discarded on close.
- **Client-side parsing mistaken for enforcement.** The drawer calls `parseAmountToMinorUnits` for immediate feedback; the route re-validates the integer, the bounds, the currency allowlist, and the merchant regardless of what arrives.
- **Clock.** Six core criteria come before any stretch goal. Tests on the generator are folded into step 2 rather than deferred, because a red/green loop there is faster than writing it twice.

## Out of scope

- Persistence, database, ORM, migrations — NWP-203. The store is in memory on purpose.
- Auth, roles, permissions.
- Real card network calls.
- Editing a limit after issue — NWP-202.

## Open questions

- **Card currency vs merchant currency.** The ticket lists them as separate form fields and only requires the currency to be in `USD/EUR/GBP`. Building them as independent, since a GBP merchant may well hold a EUR-billed vendor card. Locking currency to the merchant is a one-line change if Ops wants it.
- **"Merchant category lock."** Read as a spend category chosen on the card at issue time (`software`, `advertising`, `contractor`, `travel`, `other`), not a new taxonomy on the ten seeded merchants — the ticket's own examples are vendor subscriptions, ad spend, and contractor tools, and it says "chosen at issue time".
- **Spend figures.** There is no transaction feed linking payments to cards, so `spent` is a seeded field, not a running total. Deriving it belongs with real card transactions.
- **The workshop brief mentions a pre-push hook that refuses a red suite.** There is none in this repo — `build-battle/CLAUDE.md` says "No hooks." `npm test` and `/ship-ready` are manual gates.
