# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Santiago
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — hours of turnaround, twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see every card issued, and open one to check it, inside the console they already use.

## Current state

- No cards code exists anywhere in the app yet. `find . -iname "*card*"` (excluding `node_modules`/`.next`) turns up only `.claude/rules/cards.md` and the unrelated `src/components/ui/overview/MetricsCards.tsx`.
- `src/data/store.ts:16-22` — the `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. There is no `cards` array. `createStore()` (`store.ts:29-32`) seeds it from `generate()`, which we do not touch.
- `src/data/types.ts:1-85` defines `Currency`, the payment/dispute/payout shapes, and `PaymentFilters`. No `Card`, `CardStatus`, or `CardCategory` type exists.
- `src/data/queries.ts:18-36` — `parseFilters` is the allowlist-validation pattern: every client-supplied field is checked against a known set before it reaches a query. `filterPayments`/`queryPayments` (`queries.ts:45-106`) is "the one query builder" the org standard refers to.
- `src/lib/money.ts` already has `formatMoney` (line 15, render-only), and `parseAmountToMinorUnits` (line 46, boundary-only, returns `number | null`). Both exist and are reused, not reimplemented.
- `src/lib/dates.ts` already has `formatDate` (line 30, UTC, for tables) and the ISO-UTC convention throughout.
- `src/components/Drawer.tsx` exports `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerBody`, `DrawerFooter`, `DrawerClose` — a Radix dialog wrapper that already handles focus and Escape (`Drawer.tsx:69-97`).
- `src/app/payments/page.tsx` is the list-page pattern: server component, reads via a data function, renders a `TableRoot`/`Table`, has a written empty state (`page.tsx:93-104`), and rows link to a detail route.
- `src/app/payments/[id]/page.tsx` is the detail-page pattern: server component, `notFound()` on a missing id (line 21), a `Field` helper for labeled rows, a Divider between sections.
- `src/components/ui/navigation/AppSidebar.tsx:26-51` — `navigation` is a flat array of `{ name, href, icon, notifications }`, each `href` pulled from `src/app/siteConfig.ts`'s `baseLinks` (`overview`, `payments`, `disputes`, `payouts`). There is no `cards` entry in either file.
- `src/components/ui/payments/StatusBadge.tsx` is the badge pattern: three parallel `Record<Status, ...>` maps (label, dot color, `Badge` variant) driving one small component.
- Ticket vs. code: the ticket's stretch goal "spend progress on the card detail" assumes spend that moves. Nothing in this codebase links a payment to a card, and the design brief is explicit that `spent` stays `0` at issue. The progress bar will render correctly but cannot be exercised past 0% with real data in this ticket — noted under Risks, not treated as a defect.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; parse only at the input boundary, format only at render | `CLAUDE.md` ("Money is integer minor units... Format once, at the edge"); `money.md` | A `spendLimit` typed as `"250.00"` gets stored as a float or a decimal string, so every later comparison against `spent` is wrong |
| Validate every client input against an allowlist before it reaches the store | `api-routes.md` ("Validate everything from the client... before it reaches the store, a query, or a filename") | A bad currency, category, or status is accepted and a malformed card gets minted |
| Numbers are server-generated, on the `4242` BIN, with a valid Luhn digit | `cards.md` ("Generate on the server. A card number produced in the browser is a bug"); ticket rule 4 | A client-side or non-`4242` number could resemble a real PAN |
| The full number is returned exactly once, masked everywhere else | `cards.md` ("Reveal once... Mask everywhere else as •••• 4242"); ticket rule 2 | A full number leaks into a list/detail payload, or survives in client state after the drawer closes |
| Status is a state machine; `cancelled` is terminal; guard on the server | `cards.md` ("Status is a state machine... Guard the transition on the server, not only in the UI"); ticket rule 3 | A raw PATCH bypasses a UI-only guard and revives a cancelled card |
| Reuse existing helpers and components instead of a second implementation | `build-battle/CLAUDE.md` ("a second implementation of any of them costs points"); `components.md` ("Use what is here") | A hand-rolled input, select, or formatter drifts from how the rest of the console looks and handles money |

## Approach

Cards slot into the same three-layer shape payments already use: types, then a data-access module that owns store reads/writes and response shaping, then route handlers that validate and call it, then page components that call the data-access module directly (server components) or hit the routes (client components). Nothing here is a new pattern — `src/data/cards.ts` mirrors what `queries.ts` does for payments, and the cards route handlers validate with an explicit allowlist the same way `parseFilters` does.

**Considered and rejected:**
- *Letting the issue form choose currency independently of the merchant* — rejected. A card's currency must match its issuing merchant, so the form derives currency read-only from the selected merchant and displays it next to the limit; the server re-validates the pair independently rather than trusting the client's derivation.
- *Generating the card number client-side* — rejected outright by `cards.md`: "Generate on the server. A card number produced in the browser is a bug."
- *Deriving `spent` from existing payments* — rejected. Payments carry no card reference, so any derivation would be a fabricated linkage. `spent` stays honestly at `0` until a future ticket (not this one) links payments to cards.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change (append only) | Adds `CardStatus`, `CardCategory`, `CardStatusChange`, `Card` alongside the existing type exports |
| `src/data/store.ts` | Change | Adds `cards: Card[]` to `Store`, seeded `[]` in `createStore()`; `generate()` itself is untouched |
| `src/lib/cards.ts` | Add | Server-only number generation, Luhn check/validate, `maskCard`, `canTransition` |
| `src/lib/cards.test.ts` | Add | Unit coverage for the above, beside the code it tests, matching `src/lib/dates.test.ts`'s style |
| `src/data/cards.ts` | Add | `listCards`, `cardByIdRecord`, `cardByRequestId`, `issueCard`, `changeCardStatus`, `toCardPayload` — the cards equivalent of `queries.ts` |
| `src/app/api/cards/route.ts` | Add | `POST` (issue, with allowlist validation and idempotency) and `GET` (list) |
| `src/app/api/cards/[id]/route.ts` | Add | `GET` (detail) and `PATCH` (status transition) |
| `src/components/ui/cards/StatusBadge.tsx` | Add | `CardStatusBadge`, mirroring `ui/payments/StatusBadge.tsx`'s label/dot/variant maps for `active`/`frozen`/`cancelled` |
| `src/app/cards/page.tsx` | Add | Server component: card list, empty state, row actions |
| `src/app/cards/issue-card-drawer.tsx` | Add | Client component: the issue form and the one-time reveal screen |
| `src/app/cards/card-row-actions.tsx` | Add | Client component: freeze/unfreeze and the cancel confirm step |
| `src/app/cards/[id]/page.tsx` | Add | Server component: full record, spend bar, status history, `notFound()` |
| `src/components/ui/navigation/AppSidebar.tsx` | Change | Adds a `Cards` entry to the `navigation` array, same shape as the existing four |
| `src/app/siteConfig.ts` | Change | Adds a `cards` key to `baseLinks` so the new sidebar entry follows the existing items' exact shape (each entry's `href` reads from here — there is nowhere else to source it without breaking that pattern) |

## Plan

1. **Data model and store slot** — done when: `Card`/`CardStatus`/`CardCategory`/`CardStatusChange` compile alongside the existing types, and `store.cards` exists and is `[]` on boot with no change to any other store slot.
2. **Number generation library** — done when: `npm test` passes `src/lib/cards.test.ts` (generation loop starts `4242` and is Luhn-valid, a tampered digit fails, the `canTransition` truth table including `cancelled → anything` is false, `maskCard` output is correct).
3. **Data-access module** — done when: `issueCard` returns `{ card, fullNumber }`, pushes exactly one `Card` (with `last4` and an opaque `numberRef`, never the full number) onto `store.cards`, and `changeCardStatus` enforces `canTransition` and returns a distinguishable error on a bad transition.
4. **API routes** — done when: manual requests against the dev server show every reject case in the ticket returning 400 with `{ message }`, a currency/merchant mismatch returning 422 (or 400 with a clear message), a repeated `requestId` returning 409 without minting a second card, a valid POST returning 201 with `fullNumber` present only in that response, and `GET`/`PATCH` never including a full number.
5. **List page and navigation** — done when: `/cards` renders the empty state on the seeded (cards-less) store, and the sidebar shows a working `Cards` link that highlights when active.
6. **Issue drawer** — done when: submitting the form creates a card, the success screen shows the full number grouped in fours exactly once, and closing the drawer clears it from state and refreshes the list via `router.refresh()`.
7. **Row actions and detail page** — done when: Freeze/Unfreeze flips status without a full reload, Cancel requires its confirm step and then hides all actions, and `/cards/[id]` shows the full record, the spend bar, and status history, 404-ing on an unknown id.
8. **Full pass** — done when: `npm test` and the project's lint/build both pass, and every row in Verification below has been exercised once end to end.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via a form/dialog; it appears in the list | Submit the issue drawer at `/cards`; confirm the 201 response and the new row after refresh |
| Card list shows nickname, merchant, masked number, limit, status, created date | Visual check of `/cards` against those six columns |
| Card detail shows full record and spend against limit | Open `/cards/[id]`; confirm every field plus a 0%-filled progress bar (honest, since `spent` is always `0` at issue in this ticket) |
| Numbers generated server-side, `4242` BIN, valid Luhn | `npm test` — `src/lib/cards.test.ts`, ~50-generation loop |
| Full number shown once, masked everywhere else | Confirm the drawer's success screen is the only place the full number ever renders; confirm `GET /api/cards` and `GET /api/cards/[id]` payloads contain `masked`/`last4` only |
| Server-side validation rejects bad merchant/limit/currency | Manual requests: missing/blank nickname, missing merchant, non-integer/zero/negative/>5,000,000 limit, currency outside USD/EUR/GBP, category outside the allowlist, currency not matching the merchant's own — each checked for its status code and message |
| Freeze/unfreeze without a full reload | Click the row action; confirm a PATCH call and a `router.refresh()`, no navigation/reload in the network log |
| Spend progress bar turns amber past 80% | Code inspection of the width/color expression only — the ticket's own data model gives every card `spent = 0`, so the amber branch cannot be reached with real data in this ticket; flagged under Risks |
| Category chosen at issue, shown on the card | Select a category in the drawer; confirm it renders on the list row and the detail page |
| Unit tests on generator and transitions, `npm test` passing | `npm test` output, full suite green |
| Written empty and error states | `/cards` with no cards shows "No cards issued yet" plus a sentence; a rejected submission shows the server's message inline in the drawer, never an `alert()` |

## Risks

- The amber spend-progress threshold (`spent/limit >= 0.8`) has no way to be reached honestly in this ticket, since nothing links a payment to a card yet. The bar and its color logic will be reviewed by reading the code, not by clicking a card into the amber zone.
- Idempotency depends on the drawer generating one `requestId` per open and reusing it across retries of the same submission. If that lifecycle slips (e.g., a new id generated on every render), retries after a network blip could mint duplicate cards instead of hitting the 409 path.
- `src/data/store.ts` is cached on `globalThis` across Next.js dev-server reloads (`store.ts:24-38`); adding `cards` to the interface must not change that caching behavior or existing slots.

## Out of scope

- Persistence beyond the dev server's lifetime — tracked as NWP-203.
- Editing a card's limit after issue — tracked as NWP-202.
- Authentication, roles, and permissions.
- Real card-network calls; there is no issuer to call.
- `src/data/metrics.ts`, `src/data/analytics.ts`, `src/app/overview/**`, and `src/data/generate.ts`'s payment generation — untouched, reserved for other work.

## Open questions

- The design brief's prose about `toCardPayload` says a full number field must never appear but is ambiguous about whether `numberRef` itself belongs in the payload. This spec follows the brief's explicit field list (`id, merchantId, nickname, last4, masked, spendLimit, spent, currency, category, status, createdAt, statusHistory`), which omits `numberRef` — worth a second look in review since the accompanying sentence reads as if it expected `numberRef` to be included.
- Whether ops wants the amber spend-progress threshold exercisable in a future ticket (e.g., a way to simulate card-linked spend) is unresolved; this ticket only renders the bar correctly at `0%`.
