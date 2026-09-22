# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** plang-snyk
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens 12-20 times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus (Head of Merchant Ops) wants this in the console today.

## Current state

- `src/data/types.ts` — no `Card` type or `CardStatus` exists yet. `Currency` is `"USD" | "EUR" | "GBP"`, already the allowed set for cards.
- `src/data/store.ts` — in-memory `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`, generated once at boot and held on `globalThis.__northwindStore`. A `cards: Card[]` array goes here, initialized empty (no seed data — nothing to issue yet).
- `src/data/queries.ts` — the one query-builder pattern to follow: `parseFilters` (allowlist client params), `filterPayments`/`sortPayments`/`paginate`/`queryPayments`, and `paymentById`. Cards need an equivalent `cardById` at minimum; a full filter/sort/paginate builder is unnecessary for a list this small unless time allows.
- `src/app/api/payments/route.ts` — the route-handler shape to copy: parse+validate, call the data-layer function, `NextResponse.json(...)`. No `POST` handler exists anywhere in the repo yet — this ticket introduces the first one.
- `src/lib/money.ts` — `formatMoney`, `formatMoneyCompact`, `parseAmountToMinorUnits` (parses `"250.00"` client input into minor units at the boundary). Use `parseAmountToMinorUnits` for the spend-limit field; never hand-roll parsing.
- `src/lib/dates.ts` — `formatDate`, `formatInZone`. No `now()` helper; new records use `new Date().toISOString()` directly since they are live writes, not seed data (seed data anchors to the fixed `GENERATED_AT` in `src/data/generate.ts:58`).
- `src/components/ui/payments/StatusBadge.tsx` — `Record<AnyStatus, ...>` maps for label/dot-color/badge-variant, keyed by a union of every status type in the app. Cards' `active | frozen | cancelled` extends this same pattern (extend the `AnyStatus` union and the three `Record`s, do not create a second badge component).
- `src/components/` — has `Button`, `Input`, `Select`, `Table*`, `Badge`, `Divider`, no `Dialog`/`Modal`. Confirmed with the user: build `/cards/new` as its own route with a form, not a modal — no dialog primitive exists yet and building one costs clock time the ticket does not credit.
- `src/app/payments/page.tsx` + `src/app/payments/[id]/page.tsx` — the list/detail page shape to mirror: server component, `Table*` components for the list, `dl`/`Field` pattern for the detail record, `StatusBadge` for status, empty-state row already modeled in the payments table (`rows.length === 0`).
- `src/app/siteConfig.ts` — `baseLinks` map used by the sidebar; add `cards: "/cards"`.
- `src/components/ui/navigation/AppSidebar.tsx` — `navigation` array of `{ name, href, icon, notifications }`; add a Cards entry with a `lucide-react` icon (e.g. `Wallet` or `CreditCard` — `CreditCard` is already used for Payments, so pick a distinct icon).
- No Luhn generator exists anywhere in the repo. This ticket writes the first one.

Nothing in the ticket contradicts the code; the codebase is simply missing everything cards-related, as `merchant-console/CLAUDE.md`'s layout table says explicitly ("Cards is NWP-201 and does not exist yet").

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, no floats, no currency-symbol strings | `CLAUDE.md`, `money.md` | Spend limits drift or compare incorrectly; reuse `parseAmountToMinorUnits`/`formatMoney` |
| Never persist or display a full card number after creation; store last four + a reference | ticket rule 2, `cards.md` | A full PAN sitting in the store or a list/detail payload is the exact defect this ticket exists to prevent |
| Test BIN only: every number starts `4242` with a valid Luhn check digit | ticket rule 4, `cards.md` | A number that isn't Luhn-valid or doesn't start `4242` risks resembling a real PAN |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal | ticket rule 3, `cards.md` | An unguarded transition (e.g. reviving a cancelled card) breaks the state machine the ticket calls out explicitly |
| Generate card numbers server-side only | `cards.md` | A browser-generated number is a bug per the rule, and cannot be trusted anyway |
| Validate everything from the client against an allowlist before it reaches the store | `api-routes.md` | A bad currency, a negative limit, or a missing merchant lands in the store because the client was trusted |
| Reuse the one query builder; a second implementation is a defect | `CLAUDE.md` convention 3 | Not directly triggered (cards have no existing builder to duplicate), but the list route must not hand-roll filtering if it later needs any — keep it a plain array read for now |
| Never return a full card number from a list or detail route | `api-routes.md` | Same defect as above, enforced at the response-shape level |

## Approach

Add a `Card` domain: a type, an in-memory array on the store, a `cardById`/`listCards`/`createCard` module in `src/data/`, a Luhn generator in `src/lib/`, one `POST`/`GET` route pair at `src/app/api/cards/` plus a `PATCH` at `src/app/api/cards/[id]/status/route.ts` for freeze/unfreeze/cancel, and three pages under `src/app/cards/`: the list (`page.tsx`), the issue form (`new/page.tsx`), and the detail (`[id]/page.tsx`). The creation route is the only place the full number is ever computed or returned; the store keeps only `last4` and a `numberRef` (an opaque id, not the PAN, not even encrypted — nothing to decrypt, nothing to leak).

**Considered and rejected:** returning the full number as part of the `Card` object and filtering it out at every read site. Rejected because "filter it out everywhere" is exactly the kind of defect the ticket's rule 2 and `api-routes.md`'s "never return a full card number from a list or detail route" are warning about — one missed filter site leaks a PAN. Keeping the full number out of the stored/returned `Card` shape entirely means there is nothing to accidentally leak later.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `MerchantCategory` (if category-lock stretch is attempted), `Card` interface |
| `src/lib/luhn.ts` | add | Server-side generator: random 4242-prefixed digits + Luhn check digit; pure function, easy to unit test |
| `src/lib/luhn.test.ts` | add | Stretch: validates generated numbers pass Luhn, always start `4242`, are the right length |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store`, init empty in `createStore()` |
| `src/data/cards.ts` | add | `listCards()`, `cardById(id)`, `createCard(input)`, `setCardStatus(id, next)` — the data-layer functions the routes call; `setCardStatus` is where the state-machine guard lives |
| `src/data/cards.test.ts` | add | Stretch: status-transition table (`active→frozen` ok, `cancelled→active` rejected, etc.) |
| `src/app/api/cards/route.ts` | add | `GET` (list, no full numbers) and `POST` (validate input, generate number, create, return full number once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` one card (detail), masked |
| `src/app/api/cards/[id]/status/route.ts` | add | `PATCH` to drive the state machine (freeze/unfreeze/cancel), server-guarded |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend `AnyStatus`/`LABELS`/`DOTS`/`VARIANTS` with `active`/`frozen`/`cancelled` (cards reuse this badge, not a new one) |
| `src/app/cards/page.tsx` | add | Card list: nickname, merchant, masked number, limit, status, created date; empty state when no cards exist yet |
| `src/app/cards/new/page.tsx` | add | Issue form: nickname, merchant select, limit input, currency select; posts to `POST /api/cards`; on success shows the one-time full-number reveal |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record, masked number, spend vs. limit; freeze/unfreeze control if that stretch is attempted |
| `src/app/siteConfig.ts` | change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add a Cards nav entry |

## Plan

1. **Types + store** — add `Card`/`CardStatus` to `types.ts`, `cards: Card[]` to the store. Done when: `npm run build` (or `tsc`) has no type errors from the new field.
2. **Luhn generator** — `src/lib/luhn.ts`, generates a 4242-prefixed number with a valid check digit. Done when: a quick script or test confirms Luhn-validity and the `4242` prefix on N generated numbers.
3. **Data layer** — `src/data/cards.ts`: `listCards`, `cardById`, `createCard` (calls the Luhn generator, stores `last4` + `numberRef`, never the full number), `setCardStatus` (guards the state machine). Done when: calling these from a scratch script produces a card with masked fields and rejects an illegal transition.
4. **API routes** — `POST /api/cards` (validates merchant exists, limit is an integer 1–5,000,000 minor units, currency in `USD|EUR|GBP`; returns the full number once), `GET /api/cards` (list, masked), `GET /api/cards/[id]` (detail, masked), `PATCH /api/cards/[id]/status`. Done when: `curl` against each route returns the expected shape and status code, including the 400s for bad input.
5. **List page** — `/cards`, mirroring `payments/page.tsx`'s table + empty state. Done when: visiting `/cards` with zero and with several cards both render correctly.
6. **Issue page** — `/cards/new`, form → `POST /api/cards` → one-time reveal screen. Done when: submitting creates a card, the new card appears in the list, and the full number is visible exactly once on the success screen and nowhere after a refresh.
7. **Detail page** — `/cards/[id]`, masked number, spend-vs-limit. Done when: opening a card from the list shows its record with no full number anywhere in the page source.
8. **Nav + StatusBadge** — wire `siteConfig`, `AppSidebar`, extend `StatusBadge`. Done when: Cards appears in the sidebar and card statuses render with the right color/label.
9. **Stretch, in the order the ticket ranks them** — tests first (cheapest, first tie-break), then freeze/unfreeze without reload, then spend-progress bar, then category lock, then written empty/error states beyond the list's empty state (e.g. a failed `POST` shows a real message on `/cards/new`, not a silent failure).

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form | Submit `/cards/new`, confirm the card appears in `/cards` |
| Card list at `/cards` | Visual check: nickname, merchant, masked number, limit, status, created date all present |
| Card detail | Open a card, confirm full record + spend-vs-limit rendered |
| Generated numbers, server-side, 4242 + Luhn | `luhn.test.ts` (or a manual script) checks prefix and check digit on generated numbers; grep confirms the generator is only imported from `src/app/api/` or `src/data/`, never from a client component |
| Reveal once, mask forever | Manual: capture the number on the success screen, then confirm `GET /api/cards`, `GET /api/cards/[id]`, and the list/detail pages never render more than `last4` |
| Server-side validation | `curl -X POST` with missing merchant, limit `0`, limit `-100`, limit `5000001`, currency `"JPY"` — each returns 400 with a safe message |
| Freeze/unfreeze (stretch) | Toggle from the list without a full navigation; confirm status updates in place |
| Spend progress (stretch) | Detail page bar turns amber above 80% of limit |
| Category lock (stretch) | Category chosen at issue time is shown on the card and is not editable after |
| Tests (stretch) | `npm test` passes and includes the Luhn + status-transition suites |
| Empty/error states (stretch) | `/cards` with no cards, and `/cards/new` after a rejected submission, both show written copy |

## Risks

- **Clock risk:** six core criteria plus a `POST` route pattern that doesn't exist anywhere else in the repo is real scope for 45 minutes. Mitigation: build server-side first (steps 1-4) and confirm with `curl` before any page exists, per the ticket's own advice.
- **State-machine guard placement:** if the transition check lives only in the UI, it's a defect per `cards.md`. Mitigation: `setCardStatus` in `src/data/cards.ts` is the single place the transition table lives; the `PATCH` route calls it and nothing else implements the rule.
- **Category-lock stretch has no existing field.** `Merchant` in `types.ts` has no category today. Mitigation: if attempted, add a small fixed `MerchantCategory` enum to the card itself (chosen at issue time, per the ticket's wording — "chosen at issue time," not derived from the merchant), not a merchant-schema change.

## Out of scope

- Persistence (database, ORM, migrations) — NWP-203.
- Auth, roles, permissions.
- Real card network calls.
- Editing a card's limit after issue — NWP-202.

## Open questions

- None outstanding — the one shape question (dialog vs. dedicated page) was resolved with the user: build `/cards/new` as its own route.
