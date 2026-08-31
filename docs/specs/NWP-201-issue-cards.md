# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Kennan Murphy
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — 12 to 20 times a week, hours of turnaround, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus Bell (Head of Merchant Ops) wants this in the console: issue a card, see what's been issued, open one to check it.

## Current state

There is no cards feature yet. What exists is the pattern to build it from:

- `src/data/types.ts` — `Currency`, `PaymentStatus`, etc. live here. No `Card` or `CardStatus` type yet.
- `src/data/store.ts` — in-memory `Store` on `globalThis`, holding `merchants`, `payments`, `refunds`, `disputes`, `payouts`. No `cards` array yet.
- `src/data/queries.ts` — the pattern for a resource module: an allowlist parser (`parseFilters`), a query function, an `xById` lookup. Cards need the same shape, not a copy of this file.
- `src/data/generate.ts` — seed IDs are `prefix_` + zero-padded sequence (`pay_000001`, `dp_000001`). No seed cards should be added here; cards are created live during the session, starting from zero.
- `src/lib/money.ts` — `formatMoney`, `parseAmountToMinorUnits`. Reuse both; do not re-parse or re-format an amount by hand.
- `src/lib/dates.ts` — `formatDate` for table cells.
- `src/app/api/payments/route.ts` — thin handler, delegates validation to the data layer. Cards' POST validation belongs in `src/data/cards.ts`, not the route file.
- `src/app/payments/page.tsx`, `src/app/disputes/page.tsx` — the list-page shape: server component, `TableRoot`/`Table`, an explicit empty-row state, `StatusBadge` for status.
- `src/components/ui/payments/StatusBadge.tsx` — already keyed by a union (`AnyStatus`) covering payment/dispute/payout statuses. Extend this union with `CardStatus` rather than building a second badge.
- `src/components/Button.tsx`, `Input.tsx`, `Select.tsx`, `Badge.tsx`, `Table.tsx` — Tremor/Radix primitives, already accessible. No `Dialog` component exists despite `components.md` implying one — see Approach.
- `src/app/siteConfig.ts` / `AppSidebar.tsx` — nav is a static array keyed off `siteConfig.baseLinks`. Cards needs an entry in both.
- `package.json` — `vitest` is wired (`npm test`), with `.test.ts` files living beside the code they cover (see `money.test.ts`).

**Ticket vs. code:** the ticket's mask example — "Everywhere else it is `•••• 4242`" — appears verbatim in both `NWP-201.md` and `.claude/rules/cards.md`. Taken literally, every masked card display shows the fixed string `•••• 4242`, not that card's actual last four. This spec follows the literal, repeated text (see Domain rules and Risks).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md`, `money.md` | A `$25,000.00` limit gets stored as `25000.00` or a float; totals drift |
| Test BIN only: every number starts `4242` with a valid Luhn digit | `cards.md`, ticket rule 4 | A generated number could collide with a real PAN shape |
| Generate the card number on the server | `cards.md` | A number minted in the browser is unverifiable and a stated bug |
| Reveal once: full number only in the creation response | `cards.md`, ticket rule 2, `api-routes.md` | A refresh, a list, or a detail payload leaks a "full" number after the fact |
| Mask everywhere else as `•••• 4242` | ticket, `cards.md` (identical wording in both) | Taken literally here — see Risks if this reading is wrong |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal, guarded server-side | `cards.md`, ticket rule 3 | A frozen card could be spent from, or a cancelled one revived |
| Reject missing merchant, limit ≤ 0, limit > 5,000,000 minor units, currency outside `USD`/`EUR`/`GBP` — server-side | ticket | A bad request that a client check would have caught reaches the store |
| Validate client input against an allowlist before the store | `api-routes.md`, `CLAUDE.md` | An arbitrary currency or status string reaches a record |
| No database, ORM, or migration; cards live in `store.ts` for the process lifetime | `build-battle/CLAUDE.md`, ticket out-of-scope | Scope creep costs the clock and earns no points |

## Approach

Add a `cards` resource that mirrors the shape already in the codebase: a `Card` type in `data/types.ts`, a `cards` array on the `Store`, a `src/data/cards.ts` module that owns validation + the state machine (matching how `queries.ts` owns payment filtering), pure card-number generation in `src/lib/cards.ts` (matching `money.ts`/`dates.ts`), two route handlers, and three pages (`/cards`, `/cards/new`, `/cards/[id]`) built from existing `Table`/`Input`/`Select`/`Button`/`Badge` components. The issue flow is a dedicated page, not a modal.

**Considered and rejected:** a Radix `Dialog` opened from `/cards`, since `components.md` implies one exists. Rejected because the primitive doesn't exist yet — building an accessible Tremor-style `Dialog` (focus trap, labelling, escape-to-close, portal) before the form even starts is real time against a 45-minute clock, and the ticket explicitly allows "a form or dialog." A dedicated `/cards/new` page reuses existing components untouched, and the one-time reveal is simpler as an in-place view swap after a client-side `fetch` than as dialog state that has to be guaranteed not to survive a close.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `MerchantCategory`, `Card` |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store`, empty at boot |
| `src/lib/cards.ts` | add | `generateCardNumber`, `luhnCheckDigit` — pure, server-only, testable |
| `src/lib/cards.test.ts` | add (stretch) | Luhn validity and BIN/length checks |
| `src/data/cards.ts` | add | Allowlists, `validateIssueCardInput`, `issueCard`, `listCards`, `cardById`, `transitionCardStatus` (the guarded state machine) |
| `src/data/cards.test.ts` | add (stretch) | State-machine transition tests |
| `src/app/api/cards/route.ts` | add | `GET` (list, masked) / `POST` (create, returns full number once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` (detail, masked) / `PATCH` (stretch: freeze/unfreeze, guarded) |
| `src/app/cards/page.tsx` | add | Card list table |
| `src/app/cards/new/page.tsx` | add | Issue form → in-place one-time reveal |
| `src/app/cards/[id]/page.tsx` | add | Card detail: record + spend vs. limit |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend `AnyStatus`/`LABELS`/`DOTS`/`VARIANTS` with `active`/`frozen`/`cancelled` |
| `src/app/siteConfig.ts` | change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add a Cards nav entry |

## Plan

1. **Types and store** — add `Card`/`CardStatus` to `types.ts`, `cards: []` to `store.ts`. Done when: `npm run build` still type-checks with the new empty array wired through.
2. **Card number generation** (`src/lib/cards.ts`) — `luhnCheckDigit`, `generateCardNumber` (16 digits, `4242` + 11 random + Luhn digit). Done when: a script or REPL check confirms every generated number passes Luhn and starts `4242`.
3. **Data layer** (`src/data/cards.ts`) — allowlists (`CARD_CURRENCIES`, `MAX_LIMIT_MINOR_UNITS = 5_000_000`), `validateIssueCardInput` (missing merchant, limit ≤ 0, limit > max, bad currency all rejected with a field-level reason), `issueCard` (mints id `card_000001`-style, calls `generateCardNumber`, sets `status: "active"`, `spent: 0`), `listCards`, `cardById`, `transitionCardStatus` (rejects any transition out of `cancelled`, rejects unknown transitions). Done when: calling `issueCard` with valid input returns `{ card, fullNumber }` and the card is in `listCards()`.
4. **API routes** — `POST /api/cards` validates, calls `issueCard`, returns `{ card, fullNumber }` on 201 or `{ message }` on 400. `GET /api/cards` returns masked cards. `GET /api/cards/[id]` returns one masked card or 404. Done when: a manual `curl` POST with a bad currency returns 400 with a readable message, and a good POST returns the full number exactly once.
5. **List page** (`/cards`) — table with nickname, merchant, `•••• 4242`, limit (`formatMoney`), status (`StatusBadge`), created date (`formatDate`), and an explicit empty-row state. Done when: `/cards` renders with zero cards and again after issuing one.
6. **Issue page** (`/cards/new`) — client form (nickname `Input`, merchant `Select`, limit `Input`, currency `Select`), submits via `fetch`, swaps to an in-place reveal view showing the full number once with a "copy" affordance, then a link to the card or the list. Done when: submitting issues a card, the number is visible once, and reloading `/cards/new` shows a fresh empty form (nothing revealed twice).
7. **Detail page** (`/cards/[id]`) — full record (nickname, merchant, masked number, status, limit, currency, created date) plus spend vs. limit as text (`formatMoney(spent)` of `formatMoney(limit)`). Done when: opening a freshly issued card shows `$0.00 of $<limit> spent`.
8. **Nav wiring** — `siteConfig.baseLinks.cards`, sidebar entry. Done when: Cards is a link in the sidebar and highlights active on `/cards*`.
9. **Stretch, in order of leaderboard weight:** freeze/unfreeze (PATCH + list-row action, `router.refresh()` not a hard reload), spend progress bar (amber ≥ 80%, reusing the `spent`/limit fields already in place from step 7), merchant category lock (add `MerchantCategory` allowlist, optional `Select` in the issue form, shown on detail), tests (`lib/cards.test.ts`, `data/cards.test.ts`), richer empty/error states (a CTA on the empty list, a 404 view for an unknown card id, a visible error on a failed POST rather than a silent no-op).

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form or dialog; appears in the list | Manual: fill `/cards/new`, submit, confirm the row appears at `/cards` |
| `/cards` list: nickname, merchant, masked number, limit, status, created date | Manual: inspect table columns after issuing 2+ cards for different merchants |
| Card detail: full record + spend vs. limit | Manual: open a card, confirm every field renders and spend reads `$0.00 of $<limit>` |
| Numbers are server-generated, `4242` BIN, valid Luhn | `src/lib/cards.test.ts` (stretch) + manual: network tab shows no number before the POST response |
| Reveal once, mask forever | Manual: copy the number off the success view, then confirm `/cards` and `/cards/[id]` both show `•••• 4242`, and refreshing `/cards/new` never re-shows it |
| Server rejects bad input (missing merchant, limit ≤ 0, limit > 5,000,000, bad currency) | Manual `curl` against `POST /api/cards` for each of the four cases, expect 400 |
| `/ship-ready` passes before push | Run `/ship-ready` after step 8 |

## Risks

- **The literal `•••• 4242` mask** is the biggest open risk in this spec: if the ticket author actually meant "mask all but the real last four," every masked display in this build will be wrong. Mitigated by storing the real `last4` on the `Card` record regardless (unused by the UI for now), so switching `maskCardNumber()` to use it is a one-line change if this reading turns out wrong.
- **No card-linked transactions exist.** "Spend against the limit" is real UI but always `$0.00` this session, since nothing in the seed data or store links a payment to a card. Out of scope per the ticket; the `spent` field is a placeholder a future ticket would update.
- **45-minute clock.** Steps 1–8 are the core path and are sequenced to be gradeable independently; step 9 is ordered so partial stretch credit is possible if time runs out mid-list.

## Out of scope

- Persistence beyond the in-memory store (NWP-203).
- Auth, roles, permissions.
- Real card network calls.
- Editing a card's limit after issue (NWP-202).
- A reusable `Dialog` primitive (see Approach) — the Radix dependency is there for a future ticket to use.
- Linking cards to actual spend transactions.

## Open questions

- None blocking. The Dialog-vs-page and literal-mask calls above are made, with the reasoning and the one-line fallback recorded in case grading disagrees.
