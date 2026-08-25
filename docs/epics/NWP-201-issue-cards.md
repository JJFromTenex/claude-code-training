# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Nisha
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — twelve to twenty times a week, taking hours each time. Last month two cards went out with the wrong spend limit because the request lived in a Slack thread instead of a system that validates it. Ops needs to issue a card, see what has been issued, and check one, without leaving the console.

## Current state

- `src/app/` has `overview/`, `payments/`, `disputes/`, `payouts/` — no `cards/` yet. This ticket adds it.
- `src/data/types.ts` has no `Card` type and no `CardStatus`. `Currency = "USD" | "EUR" | "GBP"` already exists and is exactly the allowlist NWP-201 needs (`src/data/types.ts:1`).
- `src/data/store.ts:16-22` — the `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`, generated once at boot via `generate()` and held on `globalThis` so Next's dev reload doesn't reset it. Cards are created at request time, not at boot, so `store.cards` needs to start as `[]` in `createStore()` and grow via mutation from the POST handler — the first array in this store that's actually written to at runtime rather than only seeded.
- `src/data/generate.ts:55,93,110,128,178` — every seed record's id is `` `${prefix}_${pad(seq)}` `` off a closured counter (`pay_000001`, `re_000001`, `dp_000001`, `po_0001`). Cards need the same shape (`card_000001`) but the counter has to live in `store.ts`, not `generate.ts`, since cards aren't seeded.
- `src/data/queries.ts` is the full pattern to mirror: `parseFilters` (allowlist client input), `filterPayments`/`sortPayments`/`paginate`/`queryPayments` (the one query builder), `paymentById`. Cards get their own equivalents in a new `src/data/cardQueries.ts` — this is a different resource, not a payments filter, so it does not go through `filterPayments`; "one query builder" (`CLAUDE.md`, `api-routes.md`) means one path per resource, not one path for the whole app. `src/app/api/payments/route.ts` is the two-line handler shape every route follows: parse, call the store function, return JSON.
- `src/lib/money.ts` has everything money-related already: `formatMoney`, `parseAmountToMinorUnits` (rejects negatives, non-numeric, sub-cent precision — this is most of the "reject a zero or negative limit" validation for free), `sumMinorUnits`. No new money helper is needed.
- No Luhn or card-number generator exists anywhere in `src/lib/`. This is new: `src/lib/cardNumber.ts`.
- No `Dialog` component exists despite `components.md` naming one. What exists is `src/components/Drawer.tsx`, built on `@radix-ui/react-dialog` with the full Root/Trigger/Close/Portal/Overlay/Content stack and Radix's built-in focus trap — this satisfies "dialogs and forms must be operable" (`components.md`) without a new dependency. The issue-card modal reuses `Drawer`, it doesn't invent a `Dialog`.
- `src/components/ui/payments/StatusBadge.tsx` is a `Record<Status, ...>` lookup keyed by a union of every status type in the app (`AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus`). Adding `CardStatus` to that union and extending the three records is less code than a new badge component.
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx` are the list/detail pattern: server components, `searchParams` read into a typed filter object, `TableRoot`/`Table` primitives, `notFound()` for a missing id, a written empty state (`payments/page.tsx:93-104`) rather than a bare table.
- `src/data/merchants.ts` exports `merchants` (10 fictional merchants, each with a `currency`) and `merchantById` — the issue form's merchant picker and the "does this currency belong to this merchant" question both read from here. The ticket allows any of the three currencies regardless of merchant, so the merchant's `currency` is a sensible default in the form, not a constraint enforced server-side (see Open questions).
- `src/components/ui/navigation/AppSidebar.tsx:26-51` — the nav array, and `src/app/siteConfig.ts:5-10` — `baseLinks`. Both need a `cards` entry or `/cards` is unreachable from the UI.
- `vitest` is already wired (`package.json` — `"test": "vitest run"`), and `src/lib/money.test.ts` is the test-shape to copy for `cardNumber.test.ts`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md`, `money.md` | A `$` string reaches the store and every later comparison is on a string, not a number |
| Test BIN only — every generated number starts `4242` with a valid Luhn digit, "including in tests and fixtures" | `cards.md` | A generated or fixture number could pass for a real PAN |
| Generate the card number on the server | `cards.md` | A client-generated number is trivially spoofable and the rule is explicit that this is a bug, not a style choice |
| Reveal once: the full number appears only in the creation response, never on the record, a list, or a detail payload | NWP-201, `cards.md`, `api-routes.md` | A stored or re-servable full number is exactly the incident this ticket exists to prevent |
| Mask everywhere else as `•••• 4242` | `cards.md` | Inconsistent masking leaks the BIN or the wrong digits |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal, guarded server-side | NWP-201, `cards.md` | A `cancelled` card could be reactivated, or the UI's guard could be bypassed by calling the API directly |
| Validate on the server against an allowlist: missing merchant, limit ≤ 0, limit > 5,000,000, currency outside USD/EUR/GBP | NWP-201, `api-routes.md` | A crafted request creates a card the UI would have blocked |
| Never return a full card number from a list or detail route | `api-routes.md` | Same failure as "reveal once," stated again at the route-handler level |
| Reuse what's already built (Button, Input, Select, the query-builder pattern) rather than a second implementation | `CLAUDE.md`, `components.md` | Two money formatters or two filter paths start disagreeing over time |
| Dialogs and forms must be operable: labelled inputs, accessible name, focus in/out, Escape closes | `components.md` | The issue-card form is unusable by keyboard or screen reader |
| No database, ORM, or migration — the store is in-memory on purpose | `CLAUDE.md`, `build-battle/CLAUDE.md` | Time spent on persistence that NWP-203 will replace anyway |

## Approach

Add a `Card` type and a `store.cards` array (empty at boot, written to at request time — the first store slice that isn't purely seeded). Build one query module, `src/data/cardQueries.ts`, following `queries.ts`'s shape: an allowlist parser, `createCard` (generates the number, computes Luhn, derives `last4`, pushes the record, returns `{ card, number }` once), `queryCards`, `cardById`, `updateCardStatus` (the state-machine guard, used by both `POST` create-time defaults and the freeze/unfreeze route). Card-number generation and Luhn live in `src/lib/cardNumber.ts`, tested the way `money.ts` is tested. Routes are thin, mirroring `payments/route.ts`: `POST /api/cards` validates and creates, `GET /api/cards` lists, `GET /api/cards/[id]` fetches one, `PATCH /api/cards/[id]` transitions status (stretch). Pages mirror `payments/page.tsx` and `payments/[id]/page.tsx`: a server-rendered `/cards` list with the same empty-state discipline, and `/cards/[id]` for detail. The issue form is a client component using the existing `Drawer`, `Input`, `Select`, and `Button` — opened from the `/cards` list — that POSTs and then shows a one-time success view with the full number, since the rule requires that view to exist and to never be reachable again after it closes.

**Considered and rejected:** routing card creation through `filterPayments`/the payments query builder, on the theory that "one query builder" means literally one function for the whole app. Rejected — that rule (`api-routes.md`: "Payment filtering goes through the builder behind `GET /api/payments`") is scoped to payments; cards are a different resource with a different shape (no `merchantId`+`search`+date-range filtering, but a status filter that payments doesn't have), and forcing them through the payments builder would mean widening `PaymentFilters` with card-only fields or unioning two unrelated record types — more coupling than a second, equally single, `cardQueries.ts`.

**Considered and rejected:** persisting a "reference" to the full generated number (the ticket's phrase: "Store the last four and the generated number's reference") as an actual stored token, e.g. so the full number could theoretically be re-derived. Rejected — nothing in scope ever needs to re-show the number, there's no card network to reconcile against, and storing anything that could reconstruct a full PAN is a sharper version of the exact mistake the "reveal once" rule exists to prevent. `last4` is stored; the generated number is computed, returned once, and never held in the record it becomes.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | Add `CardStatus = "active" \| "frozen" \| "cancelled"`, `MerchantCategory` (stretch), and `Card` |
| `src/data/store.ts` | Change | Add `cards: Card[]` to `Store`, `[]` in `createStore()` |
| `src/lib/cardNumber.ts` | Add | Luhn check-digit calc, `generateCardNumber()` (4242 BIN), `maskCardNumber()` |
| `src/lib/cardNumber.test.ts` | Add | Luhn validity, BIN prefix, mask format — stretch "Tests" criterion |
| `src/data/cardQueries.ts` | Add | `parseCardFilters`, `parseIssueCardInput` (server validation allowlist), `createCard`, `queryCards`, `cardById`, `updateCardStatus` (state-machine guard) |
| `src/data/cardQueries.test.ts` | Add | Status-transition rules (`active⇄frozen`, `→cancelled`, `cancelled` terminal) — stretch "Tests" criterion |
| `src/app/api/cards/route.ts` | Add | `GET` (list, via `queryCards`), `POST` (validate + `createCard`, returns the number once) |
| `src/app/api/cards/[id]/route.ts` | Add | `GET` (detail, masked), `PATCH` (freeze/unfreeze via `updateCardStatus`) — stretch |
| `src/components/ui/cards/StatusBadge.tsx` or extend existing | Change | Add `CardStatus` to the existing `StatusBadge`'s `AnyStatus` union rather than a new component |
| `src/components/ui/cards/IssueCardDrawer.tsx` | Add | Client component: form (nickname, merchant `Select`, limit `Input`, currency `Select`, category `Select` for stretch) inside the existing `Drawer`, POSTs, renders the one-time reveal |
| `src/components/ui/cards/SpendProgress.tsx` | Add | Stretch: bar component, amber past 80% |
| `src/app/cards/page.tsx` | Add | List route: table (nickname, merchant, masked number, limit, status, created date), empty state, mounts `IssueCardDrawer` |
| `src/app/cards/[id]/page.tsx` | Add | Detail route: full record, `SpendProgress` (stretch), freeze/unfreeze control (stretch, no full reload) |
| `src/app/siteConfig.ts` | Change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | Change | Add a Cards nav item |

## Plan

1. **Types and store** — add `Card`/`CardStatus` to `types.ts`, `cards: []` to `store.ts`. Done when: the project still type-checks with an empty `cards` array wired through.
2. **Card number generation** — `cardNumber.ts` + its test. Done when: `npm test` passes on Luhn validity and the `4242` prefix for a batch of generated numbers.
3. **Query module** — `cardQueries.ts`: validation allowlist, `createCard`, `queryCards`, `cardById`, `updateCardStatus`, plus its test for the state machine. Done when: the test file passes, covering `active→frozen→active`, both `→cancelled`, and `cancelled` rejecting any further transition.
4. **API routes** — `POST`/`GET /api/cards`, `GET`/`PATCH /api/cards/[id]`. Done when: `curl`/manual requests show — a valid POST returns the full number once and a card record with only `last4`; an invalid POST (missing merchant, limit 0, limit 5,000,001, currency `"JPY"`) returns a 4xx with a message; a GET on the list or detail route never contains a full number.
5. **List page** — `/cards`, nav entry, empty state. Done when: `/cards` renders in the browser with the seeded-empty table and its empty state, and is reachable from the sidebar.
6. **Issue flow** — `IssueCardDrawer`, wired into `/cards`. Done when: submitting the form in the browser creates a card, the one-time reveal shows the full number, closing it and reopening the drawer or navigating to the card never shows the full number again.
7. **Detail page** — `/cards/[id]`. Done when: opening a card from the list shows its record and (stretch) a spend bar that turns amber past 80%.
8. **Freeze/unfreeze** — stretch. Done when: toggling status from the list updates without a full page reload and a `cancelled` card has no active toggle.
9. **Category lock** — stretch. Done when: category is chosen at issue time, persisted, and shown on the detail page, with no edit path.
10. **Error and empty states pass** — written copy for "no cards yet," a failed create, and a failed load, matching the payments page's discipline (`payments/page.tsx:93-104`).
11. **`npm test`, then `/ship-ready`** before pushing, per the ticket's definition of done.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card (form/dialog → appears in list) | Manual: submit the drawer, confirm the new row in `/cards` |
| Card list at `/cards` with nickname, merchant, masked number, limit, status, created date | Manual: inspect the rendered table columns |
| Card detail shows full record and spend vs. limit | Manual: open a card from the list |
| Generated numbers on the `4242` BIN with a valid Luhn digit | `cardNumber.test.ts`, run via `npm test` |
| Reveal once, mask forever | Manual: the success view shows the full number; the list, detail, and a page reload after never do. Grep the API responses of `GET /api/cards` and `GET /api/cards/[id]` for the full number pattern — it must not appear |
| Server-side validation (missing merchant, limit ≤ 0, limit > 5,000,000, currency outside USD/EUR/GBP) | Manual requests bypassing the UI (`curl`/devtools) against `POST /api/cards` for each invalid case, confirming rejection |
| Freeze/unfreeze without full reload (stretch) | Manual: toggle from `/cards` list, confirm no navigation/reload and the row updates |
| Spend progress bar, amber past 80% (stretch) | Manual: seed or create a card near its limit, inspect the bar color |
| Merchant category lock (stretch) | Manual: set at issue time, confirm shown on detail, confirm no UI path to change it after |
| Tests on Luhn generator and status transitions (stretch) | `npm test` passing, with `cardNumber.test.ts` and `cardQueries.test.ts` present |
| Empty and error states (stretch) | Manual: empty `/cards` before any card exists; a failed `POST` (e.g. limit too high) surfaces a written message in the drawer, not a console-only failure |

## Risks

- **`store.cards` is the first array in this store mutated at runtime rather than only seeded.** If a route handler ever replaces the array instead of pushing/mapping in place, other handlers holding a reference (or the `globalThis` dev-reload guard) could see stale data. Mitigate by only ever mutating in place inside `cardQueries.ts`, never reassigning `store.cards`.
- **Currency-per-merchant ambiguity** (see Open questions) could make the form confusing if a merchant's own currency isn't the default. Mitigate by defaulting the currency `Select` to the chosen merchant's `currency` and letting ops override it, since the ticket allows any of the three regardless of merchant.
- **Luhn generation could, by chance, collide with an existing card's last four + a re-derived prefix** — not a real risk here since the full number is never compared or looked up by anything, only displayed once and discarded.

## Out of scope

- Persistence — cards live for the life of the dev server; NWP-203.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a card's limit after issue — NWP-202.
- A `PATCH` for anything beyond status transitions (nickname/category edits after issue are not requested and are the same "editing after issue" exclusion above, generalized).

## Open questions

- **Does a card's currency have to match its merchant's currency?** The ticket's validation list allows USD/EUR/GBP unconditionally and never says "must match the merchant." Current plan: no server-side constraint, but the form defaults to the merchant's currency for a sane UI default. Flag if ops actually needs cross-currency limits blocked.
- **Merchant category options for the stretch lock** — the ticket says "chosen at issue time," not what the categories are. Plan: reuse a small fixed enum (`subscriptions`, `advertising`, `contractor_tools`, `other`) drawn from the ticket's own description ("vendor subscriptions, ad spend, and contractor tools"). Flag if there's a real enum this should match instead.
