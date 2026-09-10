# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** NWP-201 assignee, with Claude Code
**Status:** building

Paths are relative to `build-battle/merchant-console/` unless they start with `docs/`.

## Problem

Ops asks the platform team to create each virtual card by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue a card, see the cards they have issued, and open one to check it, all from the console.

## Current state

- `src/data/store.ts`: the in-memory store, held on `globalThis.__northwindStore`. It has `merchants`, `payments`, `refunds`, `disputes`, and `payouts`, but no cards.
- `src/data/types.ts`: `Currency = "USD" | "EUR" | "GBP"`. `Merchant.currency` is each merchant's settlement currency. There is no card type.
- `src/data/merchants.ts`: ten fictional merchants plus `merchantById()`. There are USD, GBP (`mch_04`, `mch_09`), and EUR (`mch_05`, `mch_06`) merchants. Nothing checks that a card's currency matches its merchant's.
- `src/lib/money.ts`: `formatMoney()` is the only formatter. `parseAmountToMinorUnits()` converts `"250.00"` to `25000` at the input boundary.
- `src/lib/dates.ts`: `formatDate()` gives UTC dates for tables, and `formatInZone()` converts to the merchant's timezone for detail views.
- `src/data/queries.ts`: `parseFilters()` sets the pattern where client input is allowlisted in the data layer and the route calls it. `sortPayments()` compares amounts as strings (`String(a.amount).localeCompare`), so `900` sorts after `10000`.
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx`: server pages that read the data layer directly. They set the patterns for the table, the empty state, the `Field` grid, and the timeline.
- `src/components/`: `Drawer` (Radix Dialog: focus trap, Escape, focus return), `Button` (`isLoading`, `destructive`), `Input`, `Select`, `Table`, `Badge`, and `Divider`. `src/components/ui/payments/StatusBadge.tsx` maps statuses to badge variants.
- `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx`, and `src/app/siteConfig.ts`: the nav has no Cards entry.
- `vitest.config.ts`: a Node environment, with tests at `src/**/*.test.ts` next to the code they cover.

**Where the docs and the code disagree:**

- `.claude/rules/components.md` lists a `Dialog` component, but there isn't one. `Drawer.tsx` is built on `@radix-ui/react-dialog`, so it is the dialog.
- `CLAUDE.md` says the seed data is JSON. It is generated in code, in `src/data/generate.ts`.
- The existing route handlers (`src/app/api/payments/route.ts`, `.../export/route.ts`) have no error shape. The card routes set one: `{ error: { message, fields? } }`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols." | `merchant-console/CLAUDE.md` | Limits drift; a `"250.00"` string silently becomes 250 cents |
| "The full number is returned exactly once, in the creation response. After that, last four only." | `merchant-console/CLAUDE.md`, `.claude/rules/cards.md` | A PAN-shaped value leaks through list or detail payloads, or lingers in client state |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." / "A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Numbers could resemble real PANs, or be forged client-side |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card gets reactivated through a direct PATCH |
| "Validate everything from the client against an allowlist." / "Return the same error shape everywhere." | `.claude/rules/api-routes.md` | The client becomes the only check, and a curl bypasses it |
| Reject a missing merchant, a limit ≤ 0, a limit > 5,000,000, or a currency outside USD/EUR/GBP | `docs/tickets/NWP-201.md` | Core criterion 6 |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | The issue form can't be operated from the keyboard |

## Approach

The card logic is split across two modules so that client components never pull in `node:crypto` or the store:

- `src/data/cardRules.ts` is pure. It holds constants, validation, the transition table, masking, and the spend threshold.
- `src/data/cards.ts` is server-only. It holds store operations and number generation, backed by `src/lib/cardNumber.ts`.

Pages read the data layer directly, as payments already does. Mutations go through route handlers, and those handlers are where validation happens. The `Card` type has **no field** for the full number. The number exists only as a local in `issueCard()` and in the 201 response, so no list or detail payload can leak it.

Issue requests are idempotent: the client sends an `Idempotency-Key` header, and the server records key → card id and rejects a reuse with 409. The form sets the currency from the chosen merchant, and the server still rejects a mismatch. `spent` starts at 0 and stays there, because nothing links payments to cards, and the bar shows that truthfully. Every status change appends `{ at, from, to }` to the card's `history`, which the detail page shows.

**Considered and rejected:**

- *Server Actions for issuing and freezing.* An idempotency-key header, a curl-testable contract, and "validation lives in the route handler" are all clearer with route handlers.
- *Seeding demo cards.* That would mean inventing `spent` figures. The list starts empty and shows a written empty state.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/cardNumber.ts` (+ `.test.ts`) | Add | `4242` BIN generator, Luhn check digit and validator, injectable digit source for tests |
| `src/data/types.ts` | Change | `CardStatus`, `MerchantCategory`, `CardEvent`, `Card` (no full number field) |
| `src/data/cardRules.ts` (+ `.test.ts`) | Add | Allowlists, `MAX_SPEND_LIMIT`, `validateIssueCard`, `canTransition`, `maskCardNumber`, `spendTone` |
| `src/data/store.ts` | Change | `cards` array and `cardIssueKeys` idempotency map |
| `src/data/cards.ts` (+ `.test.ts`) | Add | `listCards`, `cardById`, `issueCard`, `changeCardStatus` |
| `src/app/api/cards/route.ts` | Add | `GET` list, `POST` issue (validated, idempotent) |
| `src/app/api/cards/[id]/route.ts` | Add | `GET` detail, `PATCH` status (allowlisted, transition-guarded) |
| `src/app/cards/page.tsx` | Add | Card list with a written empty state |
| `src/app/cards/issue-card.tsx` | Add | Issue drawer, the reveal-once success view |
| `src/app/cards/card-status-actions.tsx` | Add | Freeze/unfreeze without reload, cancel with confirm, inline error |
| `src/app/cards/[id]/page.tsx` | Add | Full record, spend progress, status history |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Add `active`, `frozen`, `cancelled` rather than a second badge |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | Change | Cards in nav and breadcrumbs |
| `src/data/queries.ts` (+ `queries.test.ts`) | Change | Bug found along the way: amount sort compares strings |

## Plan

1. **Generator:** `cardNumber.ts` and tests. Done when `npm test` shows every generated number starting `4242`, 16 digits long, and passing Luhn.
2. **Rules:** types, `cardRules.ts`, and tests. Done when every ticket rejection, every transition, and the 80% threshold are covered and green.
3. **Store operations:** `cards.ts` and tests. Done when a stringified card holds no 16-digit run and a replayed key mints nothing.
4. **Routes:** `/api/cards` and `/api/cards/[id]`. Done when the curl matrix below returns the expected codes.
5. **Checkpoint:** read the server diff for minor units, validation in the route, no full number on the record, and no duplicate helper.
6. **UI:** nav, list, issue drawer, status actions, detail. Done when the browser checks below pass.
7. **Bug fix:** numeric amount sort in `queries.ts`, with a test.
8. **Ship:** `npm test`, `tsc --noEmit`, `/ship-ready`, `/pr`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill in the drawer, submit, and the row appears in `/cards` |
| Card list | Browser: `/cards` shows nickname, merchant, masked number, limit, status, created date |
| Card detail | Browser: `/cards/[id]` shows the full record and a spend bar against the limit |
| Generated numbers | `cardNumber.test.ts`; curl `POST /api/cards` returns 201 with a number starting `4242` that passes Luhn |
| Reveal once | `cards.test.ts` asserts no 16-digit run on the stored record; curl `GET` list and detail show `last4` only; browser shows the number cleared on close |
| Server-side validation | `cardRules.test.ts`; curl with missing merchant, 0, -100, 5000001, `"250.00"`, `XYZ`, and GBP on `mch_05`, each returning 400 |
| Freeze/unfreeze without reload | Browser network log shows a PATCH and an RSC fetch, with no document request |
| State machine | `cardRules.test.ts`; curl PATCH cancelled→active returns 409 |
| Idempotent issue | `cards.test.ts`; curl with the same `Idempotency-Key` twice returns 409 and the list length is unchanged |
| Currency matches merchant | `cardRules.test.ts`; curl GBP for `mch_05` returns 400 |

## Risks

- Next's hot reload keeps the old `globalThis` store, which has no `cards`. Restart the dev server after changing `store.ts`.
- `spent` is always 0, so the amber state can't be seen in the UI without fabricating spend. It is proven by the `spendTone` unit test and stated in the PR.
- Radix `Select` renders a button, not an `<input>`. Labels use `htmlFor` on the trigger id, and that has to be checked in the accessibility tree.

## Out of scope

- Persistence: NWP-203. No database, ORM, or migration.
- Editing a limit after issue: NWP-202.
- Authentication, roles, and real card network calls.

## Open questions

- There is no user identity (auth is out of scope), so the audit trail records *when* and *what*, not *who*.
- Nothing links payments to cards, so card spend has no real source yet. Where it should come from is a question for the issuer integration.
