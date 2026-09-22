# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Bing Qi
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see the cards they have issued, and open one to check it, from the console, today.

## Current state

- `build-battle/merchant-console/src/app/` — routes for overview, payments, disputes, payouts. There is no `/cards` route, no card type, and no card store. The ticket is accurate: cards do not exist yet.
- `src/data/types.ts` — `Currency` is already the `USD | EUR | GBP` allowlist the ticket asks for. `Merchant` carries `currency` and `timezone`. Amounts are documented as integer minor units.
- `src/data/store.ts` — the in-memory `Store` held on `globalThis`, with `merchants`, `payments`, `refunds`, `disputes`, `payouts`. Cards are a new array on this object, nothing else.
- `src/data/queries.ts` — `parseFilters` (line 18) is the pattern for validating client input against an allowlist before it touches the store. `paymentById` (line 108) is the lookup pattern. The payment query builder stays untouched; cards are not payments and do not go through it.
- `src/data/merchants.ts` — `merchantById` is the merchant allowlist. A merchant id that is not in this list is a "missing merchant".
- `src/lib/money.ts` — `formatMoney` renders minor units; `parseAmountToMinorUnits` (line 46) turns `"250.00"` into `25000` at the boundary. Both are reused; neither is reimplemented.
- `src/lib/dates.ts` — `formatDate` for tables, `formatInZone` for merchant-local timestamps.
- `src/app/api/payments/route.ts` — route handler shape: `NextRequest` in, `NextResponse.json` out.
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx` — the list and detail layout to match: `TableRoot`/`Table`, `StatusBadge`, `Field` `dl` grid, a timeline `ol`.
- `src/components/ui/payments/StatusBadge.tsx` — one badge for every status union in the app. Card statuses join it.
- `src/components/Drawer.tsx` — the Radix dialog primitive (`Drawer`, `DrawerContent`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`). There is no `Dialog.tsx` despite `components.md` naming one; the drawer is the dialog here.
- `src/components/Input.tsx`, `Select.tsx`, `Button.tsx` (`isLoading`), `Badge.tsx` — the form controls.
- `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx` — navigation is a static list; cards need an entry in each.
- `vitest.config.ts` — Node environment, `src/**/*.test.ts`, no DOM. Tests cover pure functions only.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` §1 | A float limit drifts; the grader fails the diff |
| "Never parse a currency string into a number... it is validated and converted at the boundary, once." | `.claude/rules/money.md` | Two parsers disagree |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `CLAUDE.md` Card rules | A number that could be a real PAN |
| "The full number is returned exactly once, in the creation response. After that, last four only." | `CLAUDE.md` Card rules, `rules/cards.md` | A PAN leaks into list, detail, or client state |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal." Guarded "on the server, not only in the UI." | `rules/cards.md` | A cancelled card comes back to life |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside `USD`, `EUR`, `GBP`." | Ticket, core criterion 6 | Wrong-limit cards, the exact bug that opened the ticket |
| "Validate everything from the client against an allowlist." | `rules/api-routes.md` | Arbitrary status or category strings in the store |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone." | `CLAUDE.md` §2 | Created dates shift by a day |
| "Write the empty and error states." | `rules/components.md` | Blank table, silent failure |

## Approach

Cards get their own vertical slice that mirrors payments: a `Card` type, a `cards` array on the existing store, a small pure module for the Luhn generator and the status state machine, a data module that validates client input and mutates the store, two route handlers, and two pages. The card record never holds the number: the generator returns the full number to the route handler, which stores `last4` plus an opaque `reference` and returns the number once, as a sibling of the card in the creation response. The issue form is a client drawer that posts to the route, shows the number on a success screen, and drops it from state when the drawer closes. Freeze/unfreeze is a client action that calls `PATCH` and then `router.refresh()` so the server-rendered list updates without a full reload. Each card carries a status history so the detail page can answer "what happened to this card last Tuesday".

**Considered and rejected:** a server action instead of route handlers. Rejected because the neighborhood uses `src/app/api/` handlers and the ticket asks for server-side validation that can be checked with `curl`. Also rejected: deriving spend from the payments table. Nothing links a payment to a card, so spend is a field on the card, seeded for the demo cards and zero for new ones.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`, `CardStatusChange` |
| `src/lib/cards.ts` | add | `TEST_BIN`, Luhn check digit + validation, `generateCardNumber`, `maskCardNumber`, `CARD_STATUSES`, `CARD_CATEGORIES`, `canTransition`, `MAX_SPEND_LIMIT` |
| `src/lib/cards.test.ts` | add | Luhn generator and status transition tests, beside the code |
| `src/data/cards.ts` | add | seed cards, `listCards`, `cardById`, `parseIssueCardInput`, `issueCard`, `changeCardStatus` |
| `src/data/cards.test.ts` | add | server-side validation cases from the ticket |
| `src/data/store.ts` | change | `cards` on the store |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue (the one response with the full number) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, `PATCH` status transition |
| `src/app/cards/page.tsx` | add | list at `/cards`, empty state |
| `src/app/cards/[id]/page.tsx` | add | detail, spend against limit, history |
| `src/app/cards/issue-card-drawer.tsx` | add | client form, server errors shown, reveal-once success screen |
| `src/app/cards/status-actions.tsx` | add | freeze/unfreeze/cancel without reload |
| `src/components/ui/cards/SpendProgress.tsx` | add | bar, amber past 80% |
| `src/components/ui/payments/StatusBadge.tsx` | change | `active`, `frozen`, `cancelled` |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | change | Cards in navigation |

## Plan

1. **Types, store, pure card module + tests** — done when: `npm test` passes with Luhn and transition cases green.
2. **Data module with validation and route handlers** — done when: `curl` to `POST /api/cards` returns 400 for each rejected input and 201 with `number` for a good one; `GET` payloads contain no `number`.
3. **List page and navigation** — done when: `/cards` renders the seed cards with all six columns and the empty state copy exists.
4. **Issue drawer with success screen** — done when: submitting creates a card, the number shows once, the list has the new row after close.
5. **Detail page with spend progress and history** — done when: opening a card shows the record, the bar, amber over 80%.
6. **Status actions from the list** — done when: freeze flips the badge without a full navigation; cancelled cards have no actions.
7. **Lint, type-check, `/ship-ready`, PR description** — done when: all green and the description names what was verified.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill the drawer, submit, close, row appears at the top of `/cards` |
| Card list | Browser: `/cards` shows nickname, merchant, `•••• 4242`, limit, status, created |
| Card detail | Browser: `/cards/<id>` shows the record and the spend bar |
| Generated numbers | `cards.test.ts`: starts with `4242`, 16 digits, Luhn valid, unique across a batch |
| Reveal once, mask forever | `curl` list and detail payloads and grep for `number`; the success screen is the only place it renders |
| Server-side validation | `cards.test.ts` + `curl` for missing merchant, 0, -1, 500000001, `JPY` → 400 |
| Freeze/unfreeze | Browser: click Freeze, badge changes, no full reload |
| Spend progress | Browser: seed card at 85% shows amber |
| Category lock | Form select, shown on list and detail |
| Tests | `npm test` summary line in the PR |
| Empty and error states | Copy in `page.tsx`; server error message rendered in the drawer |

## Risks

- Radix Select inside a Radix Dialog: both are already used in this app but not together. If focus handling misbehaves, fall back to a native `<select>` styled with the existing trigger classes.
- `router.refresh()` re-renders the server component; on the dev server this is fast, but the badge needs a pending state so a double click does not send two PATCHes.
- Seeded cards mean the empty state is not visible by default. It is written and reachable when the store has no cards.

## Out of scope

- Persistence (NWP-203), auth, real issuer calls, editing a limit after issue (NWP-202).
- Recording spend against a card. `spent` is a field, not a ledger.
- The sort-by-amount bug in `src/data/queries.ts` `sortPayments`, which compares amounts as strings. Not this ticket; noted for the reviewer.

## Open questions

- Whether the merchant category lock should be required. Assumed required with a default of `general`, since a card "needs a limit from the moment it exists" and the same logic applies to its lock.
