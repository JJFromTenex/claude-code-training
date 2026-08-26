# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then reviewed by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Kyle Atekwana
**Status:** draft

## Problem

Ops issues a virtual card by messaging the platform team, who create it by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread instead of a system. Marcus wants ops able to issue a card, see every card they've issued, and open one to check it — today, from the console.

## Current state

- `src/app/siteConfig.ts:6-9` — nav has `overview`, `payments`, `disputes`, `payouts`. No `cards` entry.
- `src/data/store.ts:16-22` — `Store` is `{ merchants, payments, refunds, disputes, payouts }`. No `cards` array. The store is a mutable object memoized on `globalThis.__northwindStore` (`store.ts:24-38`), not frozen — a `cards` array added here is written to exactly the way this repo already keeps state in memory.
- **No route in this codebase writes to the store.** Every consumer (`queries.ts`, `analytics.ts`, `metrics.ts`, `payments/page.tsx`, `disputes/page.tsx`) only reads. Issuing a card, and freezing/unfreezing/cancelling one, are this ticket's first writes. There's no existing mutation pattern to copy — decided fresh below, kept as small as the read-side patterns already are.
- `src/data/types.ts:24-37` (`Payment`) is the shape to match: string-literal status unions, money as `amount: number` + `currency: Currency`, nullable fields typed `X | null`, timestamps documented inline as `/** ISO 8601, always UTC. */`.
- `src/lib/money.ts:46-52` (`parseAmountToMinorUnits`) is the exact boundary parser for the spend-limit field — trims, strips separators, rejects non-integer-cents input by returning `null`. Reuse it; don't re-write it. `formatMoney` (`money.ts:15-23`) is the only place a decimal point should appear, for the limit and the spend display alike.
- `src/lib/dates.ts` has no gap here — `formatDate` (`dates.ts:31-36`) already formats an ISO UTC timestamp for a table cell, same as the payments list does.
- No Luhn implementation, no ID-generation utility, and no `uuid`/`nanoid` dependency exist anywhere in `src/` or `package.json` (confirmed by grep). This is new code, not a missed import.
- `src/app/payments/export-dialog.tsx` is the closest existing dialog, but it's a **GET-only download link** dressed as a `Drawer` (`Drawer.tsx`, built on `@radix-ui/react-dialog` — this is what CLAUDE.md and `.claude/rules/components.md` call "Dialog"; there is no separate `Dialog.tsx`). It has no `fetch`, no `onSubmit`, no success/error state. The issue-card form needs all three, so it borrows export-dialog's accessibility scaffolding (`<fieldset>/<legend>`, labeled inputs) but not its submission mechanism.
- `src/components/ui/payments/StatusBadge.tsx:5` types itself over `AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus`, driven by three parallel `Record<AnyStatus, ...>` maps (labels, dot color, `Badge` variant). Extending that union with `CardStatus` reuses the component; a second badge component would be the "second implementation" this codebase's own conventions warn against.
- Ticket text example `•••• 4242` reads literally as if the mask always ends in the BIN digits. It doesn't — `4242` is the *first* four digits (the BIN); the mask should show the card's real last four. Treating this as illustrative, not literal, since masking a card by its issuer BIN instead of its own last four would be a real bug in an ops tool.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units | `CLAUDE.md`, ticket rule 1 | `$250.00` stored as `25000`; a float or string anywhere here drifts on the first format |
| Never persist or display the full number after creation | Ticket rule 2 | Store `last4` + the card's own `id` as its reference; the full number exists only in the one POST response body, never re-readable |
| Status is a state machine: `active ⇄ frozen`, either `→ cancelled` (terminal) | Ticket rule 3 | An invalid transition (e.g. `cancelled → active`) must be rejected server-side, not just hidden in the UI |
| Every generated number starts with the `4242` BIN and carries a valid Luhn digit | Ticket rule 4, `CLAUDE.md` ("Nothing in this repository may resemble real payment data") | A generator that skips the BIN or the check digit produces a number that fails the one property this ticket exists to guarantee |
| Reject missing merchant, limit ≤ 0, limit > 5,000,000 minor units, currency outside USD/EUR/GBP | Ticket core criteria | Client-side-only validation is bypassable; the rule says "the client is not trusted" |
| No persistence — in-memory store only | Ticket, out of scope | Adding a DB/ORM/migration earns zero points and costs the clock |

## Approach

Add `cards` as a new entity alongside payments, following the same shapes and file layout the payments feature already uses, plus the store's first write path. A new `src/lib/cards.ts` holds the Luhn generator, the number formatter/masker, and server-side validation — mirroring how `money.ts` and `csv.ts` hold pure, testable logic beside the routes that use it. A new `src/data/cards.ts` holds `listCards`, `cardById`, `issueCard`, and `setCardStatus` — kept separate from `queries.ts` because cards share no filters with payments and mixing them would blur what `queries.ts` means in this codebase. Two routes: `POST /api/cards` (issue) and `PATCH /api/cards/[id]` (status transitions, backing the freeze/unfreeze stretch goal). Two pages: `/cards` (list, server component, mirrors `payments/page.tsx`) and `/cards/[id]` (detail, mirrors `payments/[id]/page.tsx`). The issue form is a `Drawer`-based client component that actually submits (`fetch` + `POST`), unlike `export-dialog.tsx`.

Spend against the limit has no real data behind it (no transactions, no card network calls — explicitly out of scope). Per your call: `issueCard` sets a synthetic `spentMinorUnits`, a random value from 0 up to the limit, generated once at issue time and documented as mock data in both the type and the detail page. This makes the core "spend against the limit" criterion and the spend-progress stretch goal demonstrable on every card issued, instead of every card showing an identical empty bar.

**Considered and rejected:** a full-page form instead of a dialog for issuing a card. The ticket explicitly allows either ("a form or dialog"). Rejected because the codebase already has a working `Drawer`-from-the-list-page pattern (`export-dialog.tsx`) to build from, and a dialog keeps the ops user on the list they're about to see the new card land in — a full page would mean a redirect for no benefit within the time budget.

**Considered and rejected:** extending `queries.ts` with card functions instead of a new file. Rejected because `queries.ts` is specifically the payments query builder (`parseFilters`/`filterPayments`/`sortPayments`/`paginate`/`queryPayments`) and cards need none of that — no filters, no sort, no pagination in the ticket. A separate `cards.ts` keeps each file's purpose legible.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | Add `CardStatus`, `Card` types beside `Payment` |
| `src/data/store.ts` | Change | Add `cards: Card[]` to `Store`, initialize to `[]` |
| `src/lib/cards.ts` | Add | Luhn generator + check digit, number formatter/masker, `validateIssueCardInput` |
| `src/lib/cards.test.ts` | Add | Unit tests: Luhn validity, BIN prefix, validation rejects (stretch goal, cheapest one) |
| `src/data/cards.ts` | Add | `listCards`, `cardById`, `issueCard`, `setCardStatus` (state machine enforcement) |
| `src/app/api/cards/route.ts` | Add | `POST` — validate, issue, return `{ card, fullNumber }` once |
| `src/app/api/cards/[id]/route.ts` | Add | `PATCH` — status transition, 400 on an invalid one |
| `src/app/cards/page.tsx` | Add | List: nickname, merchant, masked number, limit, status, created date; empty state |
| `src/app/cards/issue-dialog.tsx` | Add | `"use client"` — form, `fetch` POST, success screen (one-time reveal), error display |
| `src/app/cards/[id]/page.tsx` | Add | Detail: full record, spend-vs-limit, status |
| `src/app/cards/[id]/status-control.tsx` | Add | `"use client"` (stretch) — freeze/unfreeze via `PATCH`, no reload |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Extend `AnyStatus` union + the three maps with `CardStatus`, instead of a new badge component |
| `src/components/ui/cards/SpendProgress.tsx` | Add | (stretch) small bar, amber past 80% — no existing primitive to reuse |
| `src/app/siteConfig.ts` | Change | Add `cards` nav entry |

## Plan

Server side first, verified with `curl` before any UI exists.

1. **Types + Luhn + validation, with tests.** `src/lib/cards.ts` + `cards.test.ts`. Done when: `npx vitest run src/lib/cards.test.ts` passes — valid numbers, correct BIN, a deliberately-wrong check digit fails, and each of the four reject cases (`no merchant`, `limit 0`, `limit 5,000,001`, `currency "JPY"`) is rejected.
2. **Store + data layer.** `types.ts`, `store.ts`, `data/cards.ts`. Done when: `issueCard()` pushes a `Card` onto `store.cards` and returns `{ card, fullNumber }` where `card` has no full-number field at all.
3. **`POST /api/cards`.** Done when: `curl -X POST` with valid input returns 201 with the full number in the body; each of the four invalid inputs returns 400 with `{ error }`.
4. **`PATCH /api/cards/[id]`.** Done when: `curl` walks `active → frozen → active → cancelled` successfully, and a `cancelled → active` attempt returns 400.
5. **`/cards` list page.** Done when: visiting it in the browser shows the table, correctly masked, with an empty state before any card exists.
6. **Issue dialog.** Done when: submitting a valid form shows the full number exactly once on a success screen, then the card appears in the list masked.
7. **`/cards/[id]` detail page.** Done when: opening a card shows the full record and spend against the limit.
8. *(stretch)* **Freeze/unfreeze control** — no full reload. **Spend progress bar** — amber past 80%. **Merchant category lock** at issue time. **Written empty/error states** throughout.
9. **Nav entry**, then `/ship-ready`, then `npm test` + `npm run build` clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form/dialog, appears in the list | Manual: submit, observe list |
| `/cards` list: nickname, merchant, masked number, limit, status, created date | Manual + `read_page` on `/cards` |
| Card detail: full record + spend vs. limit | Manual on `/cards/[id]` |
| Numbers generated server-side, `4242` BIN, valid Luhn | `cards.test.ts` |
| Reveal once, mask forever | Manual: full number only on the POST success screen; list/detail always masked |
| Server-side validation of all four reject cases | `cards.test.ts` + `curl` against the route directly (not just the form) |

## Risks

- This is the app's first write path. A bug here (e.g. losing the `globalThis` store memoization) could make issued cards vanish on the next request in dev — worth a manual double-request check after step 2.
- Synthetic `spentMinorUnits` is mock data standing in for a feature (real transactions) that's explicitly out of scope. It must read as obviously synthetic in the epic and, ideally, in a code comment — not as a half-built transactions feature.
- No e2e test in this repo (`vitest` covers `src/lib/` only per `vitest.config.ts`) — the dialog and detail page wiring rely on the manual browser pass in steps 5–7.

## Out of scope

- Persistence, a database, an ORM, a migration.
- Auth, roles, permissions.
- Real card network calls.
- Editing a card's limit after issue (NWP-202).
- Real transaction data — spend is synthetic, generated once at issue time.

## Open questions

None outstanding. One decision made rather than assumed: synthetic spend-at-issue vs. always-zero — decided as synthetic, see Approach.
