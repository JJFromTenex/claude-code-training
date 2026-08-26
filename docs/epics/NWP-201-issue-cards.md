# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Rob (with Claude)
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see the cards they have issued, and open one to check it — in the console, without the platform team in the loop.

## Current state

- `src/data/store.ts` — the in-memory store on `globalThis`, holding `merchants`, `payments`, `refunds`, `disputes`, `payouts`. **No cards collection exists.** Cards slot in here as a new array.
- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"` already exists (line 1), as does `Merchant`. No `Card` type yet.
- `src/data/merchants.ts` — the merchant list (`mch_01`…), with `merchantById`. Card issuance validates `merchantId` against this.
- `src/data/queries.ts` — the one payment query builder (`parseFilters`, `queryPayments`). It is payment-specific; cards do not go through it, but its allowlist-parse pattern is the model to copy.
- `src/lib/money.ts` — `formatMoney`, `parseAmountToMinorUnits` already exist. **Do not write a second formatter or parser.**
- `src/lib/dates.ts` — `formatDate` for display.
- `src/app/api/payments/route.ts` — the route-handler pattern: parse via an allowlist function, return `NextResponse.json`.
- `src/app/payments/page.tsx` — the list-page pattern: server component, `Table` primitives from `src/components/Table`, dialog in a sibling client component (`export-dialog.tsx`).
- `src/components/` — Button, Input, Select, Table, Badge, Drawer, plus Radix dialog already in `package.json`. No new dependencies needed.
- `src/components/Sidebar.tsx` — console navigation; needs a Cards entry.
- Tests are `vitest run` (`npm test`), colocated as `*.test.ts` in `src/lib/`.
- The pre-push hook at `.claude/hooks/pre-push-check.sh` blocks `git push` unless `npm test` and `npm run build` both pass in `merchant-console`.

Nothing in the ticket contradicts the code.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` §Conventions | Cents drift; grader's correctness category |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `merchant-console/CLAUDE.md` §Card rules | Repo could resemble real PANs |
| "The full number is returned exactly once, in the creation response. After that, last four only." | `merchant-console/CLAUDE.md` §Card rules; `.claude/rules/cards.md` | Card data leak; reveal-once criterion fails |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal." | `merchant-console/CLAUDE.md` §Card rules | Cancelled cards come back to life |
| "Validate on the server … checked against an allowlist" | `merchant-console/CLAUDE.md` §Conventions; `.claude/rules/api-routes.md` | Client-trusted input reaches the store |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Core criterion fails |
| "Use what is here… Every input has a label, the dialog has an accessible name" | `.claude/rules/components.md` | Quality + accessibility tie-break |

## Approach

Server first. Add a `Card` type and a `cards` array to the in-memory store, a card module in `src/lib/cards.ts` (Luhn generation on the `4242` BIN, masking, the status state machine) with colocated tests, and data helpers in `src/data/cards.ts` (list, byId, create, transition). Route handlers: `GET/POST /api/cards`, `GET /api/cards/[id]`, `POST /api/cards/[id]/status`. The POST creation response is the only payload ever carrying the full number; the stored record holds `last4` and a reference only. Then UI: a `/cards` server-component list page copying the payments-page shape, an issue-card client dialog whose success step shows the full number once, and a `/cards/[id]` detail page with spend-vs-limit. Seed a handful of cards at boot (through the same generator) so the list and detail pages demonstrate spend immediately; new cards start with zero spend.

**Considered and rejected:** extending `src/data/queries.ts`'s `PaymentFilters` machinery to cover cards — rejected because that builder is documented as payment-specific ("Payment filtering goes through the builder behind `GET /api/payments`") and cards need no filtering for this ticket; a plain list keeps the diff small. Also rejected: storing the full PAN and masking at render time — the rules require never persisting it.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus` types |
| `src/lib/cards.ts` | add | Luhn generator (4242 BIN), `maskCard`, `canTransition` state machine |
| `src/lib/cards.test.ts` | add | Tests: Luhn validity, BIN prefix, transitions incl. cancelled-terminal (stretch) |
| `src/data/cards.test.ts` | add | Tests: the validation rejection matrix, creation storage guarantees, idempotent replay, transition results |
| `src/data/generate.ts` | change | Seed a few cards with spend so list/detail render real data |
| `src/data/store.ts` | change | Add `cards` to the `Store` interface and `createStore` |
| `src/data/cards.ts` | add | Store helpers: `listCards`, `cardById`, `createCard`, `transitionCard` |
| `src/app/api/cards/route.ts` | add | GET list (masked), POST create (validates, reveals once) |
| `src/app/api/cards/[id]/route.ts` | add | GET detail (masked) |
| `src/app/api/cards/[id]/status/route.ts` | add | POST freeze/unfreeze/cancel, server-guarded transitions |
| `src/app/cards/page.tsx` | add | List page: nickname, merchant, masked number, limit, status, created |
| `src/app/cards/issue-card-dialog.tsx` | add | Client dialog: form → POST → one-time reveal success step |
| `src/app/cards/[id]/page.tsx` | add | Detail page with spend-against-limit (amber past 80%, stretch) |
| `src/app/cards/card-actions.tsx` | add | Client freeze/unfreeze without reload, and cancel behind an inline confirm (stretch) |
| `src/components/Sidebar.tsx` | change | Cards nav entry |

## Plan

1. **Types + lib + tests** — done when: `npm test` passes with new `cards.test.ts` proving 4242 prefix, Luhn check digit, and every legal/illegal transition.
2. **Store + data helpers + seed** — done when: `createCard`/`transitionCard` compile and seeded cards appear in the store.
3. **API routes** — done when: `curl` shows POST rejecting a missing merchant, limit ≤ 0, limit > 5,000,000, bad currency (400s), accepting a valid body (full number in that response only), and GETs returning masked records.
4. **List page + dialog + sidebar** — done when: `/cards` renders seeded cards, submitting the dialog creates one, the success step shows the full number, and the list shows `•••• 4242`.
5. **Detail page** — done when: opening a card shows the full record and spend vs limit.
6. **Stretch: freeze/unfreeze in place, spend progress bar with amber, empty/error states** — done when: clicking freeze flips the badge without navigation.
7. **Verify + ship** — done when: `npm test` and `npm run build` pass, `/ship-ready` checklist is clean, PR written.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Submit the dialog in the browser; card appears in the list |
| Card list at `/cards` | Load the page; all six columns render for seeded + new cards |
| Card detail | Open a seeded card; record and spend-vs-limit shown |
| Generated numbers (4242 + Luhn) | `cards.test.ts` asserts prefix and Luhn validity over many generations |
| Reveal once, mask forever | Creation response is the only payload with `number` (grep + curl GET list/detail show `last4` only) |
| Server-side validation | curl each rejection case against POST `/api/cards`, expect 400 with message |
| State machine | `cards.test.ts` transition cases; curl `cancelled → active` expects 409/400 |

## Risks

- **Clock.** 45 minutes. Mitigation: server-side steps 1–3 first; every step ends verifiable, UI last.
- **Reveal leaking via client state** after the success screen. Mitigation: the dialog holds the number in local state only and clears it on close; nothing writes it elsewhere.
- **Next 15 async `params`** on dynamic routes — `params` is a Promise in this Next version; await it (the payments page already awaits `searchParams`).

## Out of scope

- Persistence (NWP-203), auth/roles, real network calls, limit editing after issue (NWP-202).

## Decisions made while building

These were open questions or "the codebase already knows" items the ticket hinted at; each is enforced server-side:

- **Spend source** — there is no card-transaction data, so seeded cards derive `spent` from the merchant's captured card payments since the card's issue date (capped at the limit); new cards start at zero. NWP-203 replaces this with real data.
- **Currency is the merchant's** — a card settles in its merchant's currency, so `parseCreateCard` rejects a mismatch and the dialog locks the currency field to the chosen merchant. This is the "picked the wrong currency" failure the ticket describes.
- **Idempotent issue** — the dialog sends one idempotency key per attempt; a retried or double-clicked submit returns the already-issued card, without the number, instead of issuing twice.
- **Cancel needs a confirm** — cancelled is terminal, so the list's cancel action sits behind an inline confirm step.
