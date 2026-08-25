# EPIC · NWP-201: Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** suniel12
**Status:** building

## Problem

Marcus Bell's ops team issues virtual cards by messaging the platform team in Slack, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a thread nobody could re-read. Ops needs to issue a card themselves, see what they have issued, and open one to check it.

## Current state

Everything below was read in this repository, not assumed.

- `src/app/` has `overview`, `payments`, `disputes`, `payouts`. There is no `cards` route: the merchant console's own `CLAUDE.md` says "Cards is NWP-201 and does not exist yet".
- `src/data/store.ts` holds the in-memory store on `globalThis.__northwindStore`, built once by `createStore()` from `generate()`. Its `Store` interface has `merchants`, `payments`, `refunds`, `disputes`, `payouts` and no card collection.
- `src/data/types.ts` defines `Currency = "USD" | "EUR" | "GBP"`, `Merchant` (with its own `currency`), and `Payment`. There is no `Card` type.
- `src/lib/money.ts` already has `formatMoney`, `formatMoneyCompact`, `sumMinorUnits`, and `parseAmountToMinorUnits`. A second formatter would be a defect, so the card work uses these.
- `src/lib/dates.ts` has `formatDate` (UTC, for tables) and `formatInZone` (merchant timezone, for detail pages). No new date helper is needed.
- `src/data/queries.ts` is the one payment query builder, with `parseFilters` doing allowlist validation of client params. It is payment shaped (`filterPayments` reads `store.payments` directly), so cards get their own reads rather than being forced through it.
- `src/app/payments/page.tsx` is a server component calling `queryPayments` directly rather than fetching `/api/payments`. Card pages follow that pattern.
- `src/components/ui/payments/StatusBadge.tsx` maps status to a Tremor `Badge` variant plus a dot colour. Card status gets its own badge in the same shape.
- `src/components/Drawer.tsx` is the Radix dialog wrapper (`Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerBody`, `DrawerFooter`, `DrawerClose`). It gives focus trap, focus return, and Escape for free.
- **Where the ticket does not match the code:** `.claude/rules/components.md` lists a `Dialog` primitive. There is no `src/components/Dialog.tsx`. `Drawer.tsx` is the Radix dialog in this repo, so that is what the issue form uses.
- `vitest.config.ts` includes only `src/**/*.test.ts`, so no `.tsx` is ever compiled by the suite. A green suite does not prove the UI builds; `npm run build` and `npx tsc --noEmit` do.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | root `CLAUDE.md`, `.claude/rules/money.md` | Limits drift by cents and a `$5,000` card authorises `$5,000.01` |
| "Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md`, ORG-STANDARDS #2 | A formatted string re-enters arithmetic and the totals stop reconciling |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | Something in the repository resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The PAN exists in client memory before it ever should |
| "The full number appears in the creation response and nowhere else." | `.claude/rules/cards.md`, ORG-STANDARDS #8 | A list or detail payload leaks a PAN to anything that can read a response |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life through a hand made request |
| "Validate everything from the client against an allowlist." | `.claude/rules/api-routes.md`, ORG-STANDARDS #7 | Currency, limit, and merchant arrive unchecked at the store |
| "Storage and bucketing are UTC." | root `CLAUDE.md`, ORG-STANDARDS #4 | Created dates disagree with the payments table |

## Approach

Cards get a thin vertical slice that mirrors how payments already work. Pure logic goes in `src/lib/cards.ts` (Luhn, generation on the `4242` BIN, masking) and `src/data/card-status.ts` (the transition table), each with a `.test.ts` beside it, because both are the parts that must be provably right. `src/data/cards.ts` owns the store reads and writes plus allowlist validation, playing the role `queries.ts` plays for payments. Two route handlers do the mutating: `POST /api/cards` issues, `PATCH /api/cards/[id]/status` transitions. The three pages under `src/app/cards/` are server components reading the store directly, with two small client components for the issue dialog and the row actions, so freeze and unfreeze happen through `router.refresh()` rather than a page load. The full number exists in exactly one place: the return value of the issue call, passed straight to the success screen and dropped from state when the dialog closes.

Beyond the listed criteria, four things an ops tool needs the second a real person uses it: the issue call is idempotent on an `Idempotency-Key` so a double click does not issue two cards; a card's currency is the merchant's currency, because a single merchant card in a currency the merchant does not settle in is a support ticket waiting to happen; spend is summed from recorded authorisations and shown as zero when it is zero, never invented; and every transition writes a `CardEvent` so "what happened to this card last Tuesday" has an answer on the detail page.

**Considered and rejected:** routing card filtering through `queryPayments` in `src/data/queries.ts` to honour the one-query-builder rule literally. It lost because that builder's filters, search haystack, and sort keys are payment fields (`description`, `last4`, `amount`); bending cards through it would mean widening `PaymentFilters` and `filterPayments` for a type they do not describe, which is a worse violation of ORG-STANDARDS #9 than giving cards their own small reader. The rule protects *payment* lookups from a second implementation, and none is being added.

**Also rejected:** returning the full number again on an idempotent replay. A retry is convenient but "reveal once" is the stronger rule, so a replay returns the masked record and a `replayed: true` flag.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/cards.ts` | add | Luhn check digit, `4242` generation, `•••• 1234` masking. Pure, so it is testable |
| `src/lib/cards.test.ts` | add | Proves the BIN, the check digit, and that generated numbers validate |
| `src/data/card-status.ts` | add | The transition table and `canTransition`, kept pure and separate from storage |
| `src/data/card-status.test.ts` | add | Proves `active ⇄ frozen`, both to `cancelled`, and that `cancelled` is terminal |
| `src/data/cards.ts` | add | Allowlist validation, store reads, issue and transition writes, spend totals |
| `src/data/cards.test.ts` | add | Proves validation rejects the six bad inputs and that issue is idempotent |
| `src/data/types.ts` | change | `CardStatus`, `MerchantCategory`, `Card`, `CardAuthorization`, `CardEvent` |
| `src/data/store.ts` | change | Add `cards`, `cardAuthorizations`, `cardEvents`, and the idempotency map |
| `src/data/generate-cards.ts` | add | Deterministic seed cards and authorisations so the list is not empty at boot. Kept out of `generate.ts` so existing seed output does not move |
| `src/app/api/cards/route.ts` | add | `POST` issues (the one reveal), `GET` lists masked |
| `src/app/api/cards/[id]/status/route.ts` | add | `PATCH` transitions, guarded server side |
| `src/app/cards/page.tsx` | add | The `/cards` list |
| `src/app/cards/[id]/page.tsx` | add | Card detail, spend against limit, audit trail |
| `src/app/cards/issue-card-dialog.tsx` | add | Client Drawer form and the reveal-once success screen |
| `src/app/cards/card-actions.tsx` | add | Freeze, unfreeze, cancel-with-confirm, via `router.refresh()` |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Card status badge, shaped like `StatusBadge.tsx` |
| `src/components/ui/cards/SpendProgress.tsx` | add | Spend bar, amber past 80% |
| `src/app/siteConfig.ts` | change | Add `cards: "/cards"` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add the Cards nav item |

## Plan

1. **Types, store, seed.** Done when `npx tsc --noEmit` passes with `Card` in the store and seeded cards present.
2. **`src/lib/cards.ts` and its test.** Done when `npx vitest run -t "luhn"` passes and every generated number starts `4242` and self validates.
3. **`src/data/card-status.ts` and its test.** Done when a `cancelled → active` attempt is refused by a passing test.
4. **`src/data/cards.ts` and its test.** Done when validation rejects missing merchant, zero, negative, over 5,000,000, a bad currency, and a merchant mismatch, and a repeated idempotency key returns the same card id.
5. **Route handlers.** Done when `curl -X POST /api/cards` returns a `4242` number once and `GET /api/cards` never contains one.
6. **List, detail, dialog, actions, nav.** Done when `npm run build` passes and the browser walkthrough below is clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card, it appears in the list | Browser: open `/cards`, issue, see the new row without navigating away |
| `/cards` list shows the six required columns | Browser: read the table header and a row |
| Detail shows the full record and spend against limit | Browser: open a seeded card with spend, read the bar |
| Numbers are server generated, `4242` BIN, valid Luhn | `src/lib/cards.test.ts`, plus generation living only in a route handler |
| Reveal once, mask forever | Browser: success screen shows the number, the row and detail show `•••• nnnn`; `GET /api/cards` response inspected for the absence of a `number` field |
| Server side validation | `src/data/cards.test.ts` for each rejected input, plus a `curl` POST with `limit: 0` returning 422 |
| Freeze and unfreeze without a full reload | Browser: click Freeze, the badge changes with no navigation |
| Spend bar turns amber past 80% | Browser: the seeded near-limit card renders amber |
| Category lock chosen at issue and shown | Browser: pick one at issue, read it on the detail page |
| Tests pass | `npm test` |
| Empty and error states are written | Browser: `/cards` with an unmatched filter, and a deliberately invalid submit |

Whole-suite gates before push: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. The last two matter because vitest never compiles a `.tsx` in this repo.

## Risks

- **A green suite that does not build.** `vitest.config.ts` includes only `src/**/*.test.ts`. Mitigation: `npm run build` and `npx tsc --noEmit` are gates, not optional.
- **Currency enforcement rejecting a legitimate request.** Tying a card's currency to its merchant is stricter than the ticket asks. Mitigation: the currency field is omitted-safe (it defaults to the merchant's currency), the form keeps them in sync so a user cannot trip it, and the rejection message names the merchant's currency.
- **A PAN leaking through a payload.** Mitigation: the full number is never assigned to a `Card` field at all, so no serializer can reach it; it exists only as a local in the issue call's return.

## Out of scope

- Persistence, database, ORM, migrations. That is NWP-203, and the store is in memory on purpose.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a limit after issue. That is NWP-202, so the detail page has no limit field to edit.
- The pre-existing defects in `src/data/metrics.ts` (local-time bucketing, float accumulation) and `src/data/queries.ts:81` (amount sorted with `localeCompare`). They belong to NWP-102 and touching them here would widen the diff.

## Open questions

- Should a cancelled card stay in the default list view or drop out of it? Assumed it stays, with a status filter, because ops asking "what happened to that card" needs to find it.
- Is a category lock enforced against anything today? Assumed not: there is no authorisation path in this app, so it is recorded on the card and displayed, and enforcement lands with the issuer integration.
