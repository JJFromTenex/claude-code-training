# EPIC · NWP-201 — Issue virtual cards from the console

> **Written after implementation, not before it.** The build was planned in a
> session that explored the codebase first and made these decisions in this
> order, but no epic file existed while the code was written. This records the
> design and the reasoning accurately; it is not a plan that guided the work,
> and it should not be read as one.
>
> Load it as context when you extend this: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** you
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Merchants use these for vendor subscriptions, ad spend, and contractor tools; they are single-merchant, always virtual, and need a limit from the moment they exist.

## Current state

What was true before this ticket:

- `src/data/store.ts` — in-memory store on `globalThis`, seeded once at boot from `src/data/generate.ts`. Held no cards.
- `src/data/generate.ts` — deterministic seed data behind a module-level `mulberry32` PRNG. Because `rand` is consumed sequentially, anything added **before** the payment loop shifts every existing record.
- `src/data/types.ts` — `Payment`, `Merchant`, `Dispute`, `Payout`. No card type.
- `src/data/queries.ts` — the one payment query builder. Cards are a separate collection, so this is not the place for them and must not be duplicated for them.
- `src/lib/money.ts` — `formatMoney`, `sumMinorUnits`, and `parseAmountToMinorUnits`, the last documented as "boundary only". That is exactly the spend-limit case; a second parser would be a defect.
- `src/lib/dates.ts` — `formatDate` (UTC) and `formatInZone` (merchant timezone). `src/app/payments/[id]/page.tsx` shows both on a record; card detail should match.
- `src/components/Drawer.tsx` — Radix dialog wrapper with focus trap and Escape already handled. No `Checkbox` or `RadioGroup` primitive exists.
- `src/components/ui/payments/StatusBadge.tsx` — a fixed union of payment, dispute, and payout statuses. Extending it beats a second badge.
- `src/app/payments/filter-bar.tsx` — the established pattern for a `"use client"` sibling that takes server-computed props and pushes a URL.
- **Nothing in `src/` performed a write.** No `fetch`, no POST handler, no `router.refresh()`. This ticket establishes that path.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md` 1, ticket rule 1 | Cents drift on every limit and every total |
| Storage and bucketing are UTC; display converts | `CLAUDE.md` 2 | Created dates disagree per viewer |
| One query builder; no second implementation | `CLAUDE.md` 3 | Card and payment filtering silently diverge |
| Validate on the server against an allowlist | `CLAUDE.md` 4, ticket criterion 6 | The client becomes the enforcement, which it never is |
| 4242 test BIN with a valid Luhn digit, generated server-side | `rules/cards.md`, ticket rule 4 | Something in the repo could resemble a real PAN |
| Full number returned exactly once, masked everywhere after | `rules/cards.md`, ticket rule 2 | A card number becomes re-readable, which is the whole risk |
| `active ⇄ frozen`, either to `cancelled`, `cancelled` terminal | `rules/cards.md`, ticket rule 3 | A cancelled card comes back |
| Dialogs operable: labels, accessible name, focus, Escape | `rules/components.md` | The form is unusable by keyboard or screen reader |

## Approach

Split the card domain in two along the line the codebase already draws. Pure logic — Luhn, masking, the state machine, the request validator — goes in `src/lib/cards.ts` with its test beside it, matching how `money.ts`, `dates.ts`, and `csv.ts` are organised. Store access goes in `src/data/cards.ts`, matching `queries.ts`. Route handlers stay thin: parse, validate, delegate, respond.

The full number exists only as the return value of `issueCard()` and only reaches the `POST /api/cards` response. It is never a field on the record, so no later read can produce it — the guarantee is structural rather than a rule someone has to remember. The UI mirrors this: the reveal screen holds it in React state, and closing the screen drops it.

Server components read the store directly; the API routes exist for the client-facing writes, and the client refreshes with `router.refresh()` rather than re-fetching a list itself.

**Considered and rejected:** putting card filtering through `src/data/queries.ts` to honour "one query builder". Rejected because that builder is payment-shaped — its filters are status, merchant, search, and date over `store.payments`, and its `paginate()` assumes that collection. Cards are a different collection with different filters; reusing it would mean widening it for a second entity, which makes the shared thing worse. The rule forbids a *second implementation of the same lookup*, not a second collection. Card filtering is deliberately its own small function.

**Also rejected:** accepting `spendLimit` as a number. `10` is ambiguous about its units, and a wrong guess is exactly the class of bug the money rule exists to stop. The route takes a string and parses it once, at the boundary, through the existing helper.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/cards.ts` | Add | Luhn, BIN, masking, state machine, validator. Pure, injectable RNG |
| `src/lib/cards.test.ts` | Add | Pins the generator and the transitions — the two things the ticket names |
| `src/data/cards.ts` | Add | list/read/issue/status against the store; returns the number, never stores it |
| `src/data/types.ts` | Change | `Card`, `CardStatus`, `CardCategory`, `CardEvent`, `CardFilters` |
| `src/data/store.ts` | Change | Hold the cards array |
| `src/data/generate.ts` | Change | Seed cards, generated **last** so payment records stay byte-identical |
| `src/app/api/cards/route.ts` | Add | GET list, POST issue — the one response carrying a full number |
| `src/app/api/cards/[id]/route.ts` | Add | GET one, PATCH status through the guarded machine |
| `src/app/cards/page.tsx` | Add | The list, with filters and written empty states |
| `src/app/cards/[id]/page.tsx` | Add | Full record, spend against limit, history |
| `src/app/cards/issue-dialog.tsx` | Add | The form and the one-time reveal |
| `src/app/cards/card-actions.tsx` | Add | Freeze/unfreeze/cancel without a reload |
| `src/app/cards/filter-bar.tsx` | Add | Mirrors `payments/filter-bar.tsx` |
| `src/components/Field.tsx` | Add | One labelled `<dl>` row, shared by card and payment detail |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Extend with the three card statuses rather than add a badge |
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | Change | Route and nav entry |

## Plan

Server first, verified before any UI exists.

1. **Types and store** — done when a `Card` exists in `types.ts` and `store.cards` is seeded without any payment record changing.
2. **`src/lib/cards.ts`** — done when Luhn, masking, transitions, and the validator exist as pure functions with no store import.
3. **`src/lib/cards.test.ts`** — done when `npx vitest run src/lib/cards.test.ts` passes, including 200 generator draws and every terminal-state case.
4. **Routes** — done when `curl` shows a 4242/Luhn-valid number on POST, no number on any GET, a 400 per validation rule, and 200/409/404 across the state machine.
5. **List and detail** — done when both render seed cards with masked numbers and money formatted from minor units.
6. **Issue dialog** — done when a card issued in the browser reveals once and the number is absent from the DOM after close.
7. **Actions** — done when freezing from the list changes the row with no page reload.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Issue one in the browser; it appears in the list |
| Card list | `/cards` renders all six required columns |
| Card detail | `/cards/[id]` renders the record and spend against limit |
| Generated numbers | Luhn checked independently of the helper that made it |
| Reveal once, mask forever | DOM inspected after close; API re-read returns no number field |
| Server-side validation | One `curl` per rejection rule, each returning 400 |
| State machine | `curl` every legal and illegal transition; assert the audit trail |
| No second query builder | `data/cards.ts` filters its own collection; `queries.ts` untouched |

## Risks

- **Seed ordering.** Generating cards before payments would shift every seeded payment and break the "identical records on every machine" guarantee. Mitigated by generating cards last; verified by the payment records being unchanged in the diff.
- **A number leaking into a later read.** Mitigated structurally rather than by discipline: the field does not exist on `Card`, so there is nothing to leak.
- **Hand-rolled checkbox and radio inputs**, since no primitive exists. Mitigated with real `<label htmlFor>` on every input and a keyboard pass before calling it done.

## Out of scope

- Persistence of any kind — NWP-203. Cards live until the dev server restarts.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a limit after issue — NWP-202.

## Open questions

- **`spend` is a field on the record, seeded, rather than derived from card transactions.** There is no card-transaction concept in the store, and adding one is a larger change than this ticket asked for. If spend should be derived, that is a real design difference and a follow-up worth its own ticket.
- **Idempotency is client-side only** — the issue form guards the second click, but the server has no idempotency key, so a replayed request would create a second card. Worth a follow-up if ops ever issues over a flaky connection.
