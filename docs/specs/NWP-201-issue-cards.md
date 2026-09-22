# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Build plan:** `plan (1).md` (local, not in the repo) — wins on order of work
**Author:** Claude Code (draft), pending review
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus wants it in the console: issue a card, see the cards you have issued, open one to check it.

## Current state

- `src/data/types.ts` — `Payment`, `Merchant`, `Refund`, `Dispute`, `Payout`, `PaymentFilters`. **No `Card` type.** `Currency` is `"USD" | "EUR" | "GBP"` (types.ts:1), exactly the ticket's allowed set. `Payment.amount` is documented "Integer minor units. Never a float." (types.ts:27).
- `src/data/store.ts:16-22` — the `Store` interface, one array per entity, no `cards`. The store is pinned to `globalThis` (store.ts:24-38) so the dev server's module reloading doesn't hand each request a fresh copy. A new entity array must be added to both the interface and `createStore()` (store.ts:29-32).
- `src/data/generate.ts` — deterministic seed data. `mulberry32` PRNG (generate.ts:21); ids built with a **local, unexported** `pad()` (generate.ts:55) giving `pay_000001`, `re_000001`, `dp_000001`, `po_0001`. **Payment `last4` is `String(between(1000, 9999))` (generate.ts:101) — random, not on the `4242` BIN, no Luhn digit.**
- `src/data/queries.ts:18` — `parseFilters` is the house allowlist-validation *pattern* (status checked against `STATUSES` at queries.ts:5, page coerced). It is payment-filter specific; there is no general field validator.
- `src/app/api/payments/route.ts` — the only list handler: `parseFilters` → `queryPayments` → `NextResponse.json`. Seven lines.
- **The repo is GET-only.** No `POST`, `PATCH`, `PUT` or `DELETE` handler exists anywhere under `src/app/api/`, so there is no established mutation shape, no error-body shape, and no 4xx precedent to copy.
- `src/lib/money.ts` — `formatMoney` (money.ts:15), "the only place a decimal point appears"; **`parseAmountToMinorUnits` (money.ts:46) already converts `"250.00"` to `25000` by string parsing, marked "Boundary only"**; `sumMinorUnits` (money.ts:41).
- `src/lib/dates.ts:31` — `formatDate`, the short UTC date tables use.
- `src/components/` — `Button.tsx` (variants primary/secondary/light/ghost/destructive), `Input.tsx`, `Select.tsx`, `Table.tsx`, `Badge.tsx`, `Drawer.tsx`. `Drawer.tsx:3` wraps `@radix-ui/react-dialog`, so it already supplies the focus trap, Escape-to-close and an accessible name. **There is no `Dialog.tsx`, `Checkbox` or `RadioGroup`.**
- `src/components/ui/payments/StatusBadge.tsx` — the status-pill pattern to mirror for card status.
- Page patterns to mirror: `src/app/payments/page.tsx` (server-component list, URL-driven), `src/app/payments/[id]/page.tsx` (detail), `src/app/payments/filter-bar.tsx` (client component, `useRouter` + local state).
- Nav entries live in `src/components/ui/navigation/AppSidebar.tsx` and `src/app/siteConfig.ts`; `/cards` must be added or the route is unreachable.

### Where the ticket and the build plan disagree with the code

- The plan says to reuse "NWP-101's router, validation helper, id generator, error shape". **Only the router pattern exists.** NWP-101 (commit `7c28431`, branch `NWP-101-export-options`) introduced a 400 `{ message }` body, but that branch is unmerged and is not this branch's base. The id generator, field validator and error shape are net new here.
- The plan's Phase 2 asks for a new `toMinorUnits` helper. `parseAmountToMinorUnits` (money.ts:46) already does exactly that — writing a second one is the duplication the plan itself penalises.
- `CLAUDE.md`'s card rule ("Generated numbers use the `4242` test BIN and a valid Luhn check digit") is **not** true of existing seeded *payment* `last4` values (generate.ts:101). Read as a rule for cards, not a retro-fix to payments.
- The plan suggests the spec path `docs/specs/NWP-201.md`; the `/spec` skill mandates `<ticket-id>-<branch-slug>.md`, so this file is `NWP-201-issue-cards.md` and the plan's PR template reference needs the same correction.
- **Nothing in the system ever spends on a card**, so `spentMinor` would be permanently `0`, making the ticket's "spend against the limit" and the amber-past-80% stretch unverifiable by clicking. Resolved with the engineer: seed a few demo cards with non-zero spend.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge" | `CLAUDE.md` Conventions 1 | Limits and spend drift; `formatMoney` stops being the only decimal point |
| "The full number is returned exactly once, in the creation response. After that, last four only." | `CLAUDE.md` Card rules | A full PAN leaks into a list, detail, log or client cache |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `CLAUDE.md` Card rules; ticket rule 4 | Repo data could resemble a real PAN |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal." | `CLAUDE.md` Card rules; ticket rule 3 | A cancelled card comes back to life |
| "Validate on the server. Anything from the client … is checked against an allowlist" | `CLAUDE.md` Conventions 4; `.claude/rules/api-routes.md` | Client-only checks are bypassable |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Generation becomes client-trustable |
| "Mask everywhere else as `•••• 4242`" | `.claude/rules/cards.md` | Inconsistent masking |
| "Do not add a database, an ORM, or migrations." | `CLAUDE.md`; ticket out-of-scope | Clock burned on NWP-203's job |

## Approach

Extend the existing type/store/generate triangle with `Card`, then put the real logic in pure, tested `src/lib/` modules (number generation with a Luhn digit, a status transition table, create-input validation), then keep the App Router handlers thin wrappers over them, then build pages mirroring the payments list/detail structure. The full number is produced inside the create handler and returned in that one response; the stored record holds only `last4` and an opaque `reference`. Every status change goes through the one transition table on the server, so the UI can only ever disable what the server already refuses. Money stays integer minor units end to end, converted from form input by the existing `parseAmountToMinorUnits` and rendered by the existing `formatMoney`.

**Considered and rejected:** generating card numbers inside `src/data/generate.ts` next to the seed PRNG — rejected because that PRNG is deterministic by design (generate.ts:16-31), so every issued card would get a predictable number, and because issuing is runtime behaviour rather than seed data. Generation goes in a `src/lib/` module using crypto randomness.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Add `Card`, `CardStatus`, and the create-response type | No card type exists; the response type is the only place a full number appears |
| `src/data/store.ts` | Add `cards` to `Store` and `createStore()` | Cards need to live for the process lifetime |
| `src/data/generate.ts` | Seed a few demo cards, one with spend past 80% | Makes detail and the progress bar demonstrable |
| `src/lib/cards.ts` (new) | `luhnCheckDigit`, `isValidLuhn`, `generateCardNumber`, masking helper, next-id helper | The 4242 + Luhn rule, server-side, pure and testable |
| `src/lib/cards.test.ts` (new) | Luhn, generator and masking tests | Stretch goal; cheapest proof of the BIN rule |
| `src/lib/card-status.ts` (new) | Transition table, `canTransition`, `transition` | One server-side state machine |
| `src/lib/card-status.test.ts` (new) | Every allowed edge, every rejected edge | Stretch goal |
| `src/data/card-queries.ts` (new) | Create-input validation, list/detail/mutation against the store | Mirrors `queries.ts` as the one card query module |
| `src/app/api/cards/route.ts` (new) | `GET` list (masked), `POST` create (reveal once) | Core criteria 1, 2, 5 |
| `src/app/api/cards/[id]/route.ts` (new) | `GET` detail, 404 on unknown id | Core criterion 3 |
| `src/app/api/cards/[id]/status/route.ts` (new) | `POST` freeze / unfreeze / cancel via the transition table | Stretch: freeze without reload |
| `src/app/cards/page.tsx` (new) | List page plus a written empty state | Core criterion 2 |
| `src/app/cards/[id]/page.tsx` (new) | Detail, spend vs limit | Core criterion 3 |
| `src/app/cards/issue-card-dialog.tsx` (new) | Issue form on `Drawer`; success screen holding the number in local state only | Core criteria 1, 5 |
| `src/app/cards/card-actions.tsx` (new) | Freeze / unfreeze / cancel controls | Stretch |
| `src/components/ui/cards/CardStatusBadge.tsx` (new) | Status pill mirroring `StatusBadge.tsx` | Consistency with payments |
| `src/components/ui/navigation/AppSidebar.tsx`, `src/app/siteConfig.ts` | Add the `/cards` nav entry | Otherwise the route is unreachable |

## Plan

Sequenced so each step ends somewhere verifiable. Phase numbering follows the build plan.

1. **Types, store, seed** — done when `npm test` is still green and the dev server boots with a `cards` array present.
2. **Generator module + tests** — done when tests assert 16 digits, a `4242` prefix, digits only, Luhn-valid across many generated numbers, and that two calls differ.
3. **Transition table + tests** — done when every allowed edge passes and `cancelled → *` plus same-state transitions fail.
4. **Validation, create and list handlers** — done when curl creates a card (201, 16-digit Luhn-valid number in the body), the list response contains no full number, and missing merchant / limit `0` / `-1` / `5000001` / currency `JPY` each return 400 naming the offending field.
5. **Detail and status handlers** — done when curl gets detail, freezes, unfreezes, cancels, and a freeze after cancel is rejected; an unknown id returns 404.
6. **Checkpoint** — answer the build plan's five diff questions with `file:line` or "none", then commit.
7. **Phase 2 UI** — list, issue dialog, success screen, detail; then stretch items in the plan's order.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card; it appears in the list | Click through at `/cards`, plus the curl create in step 4 |
| List shows nickname, merchant, masked number, limit, status, created | Browser check at `/cards` |
| Detail shows the record and spend against the limit | Browser check on a seeded card with non-zero spend |
| Numbers generated server-side on the 4242 BIN with a valid Luhn digit | `src/lib/cards.test.ts` via `npm test` |
| Reveal once, masked everywhere else | Success screen shows it once; refresh shows masked; grep list/detail JSON for a 16-digit run |
| Server-side validation of merchant, limit bounds, currency | The five curl cases in step 4 |
| Freeze / unfreeze without a reload (stretch) | Browser check, state updated from the response |
| Amber past 80% (stretch) | Unit test on the threshold helper, plus the seeded above-80% card |

## Risks

- The store lives on `globalThis` (store.ts:34) and a dev server from the previous session is already running. Adding `cards` to the `Store` shape will not appear until it restarts; if the list 500s on a stale store, restart before debugging.
- Reveal-once is easy to break by feeding the POST response straight into a list cache. The number must stay in the success screen's local state and never reach the URL or storage.
- The 45-minute budget assumes Phase 1 is roughly 15 minutes. Three new pure modules plus five handlers is the bulk of the work; if behind, the plan's ordering — server correctness first — is what to preserve.

## Out of scope

- Persistence of any kind — NWP-203.
- Editing a card's limit after issue — NWP-202.
- Auth, roles, permissions; real card-network calls.
- Retro-fitting the `4242` BIN onto existing seeded payment `last4` values (generate.ts:101).

## Open questions

- Should a cancelled card stay in the default `/cards` list or be filtered out behind a toggle? The ticket says the list shows "every issued card", so this spec shows all of them with status visible.
- Is `merchant` free text or a reference to an existing `Merchant` (`src/data/merchants.ts`)? The ticket says "the merchant" and the build plan types it `merchant: string`. This spec follows the plan with free text, but a select bound to `merchants` would match the payments filter bar better. Worth deciding before Phase 2.
