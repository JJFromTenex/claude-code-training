# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** sreynolds
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants issuing, listing, and inspecting cards in the console, today.

## Current state

- `src/data/types.ts` — domain types. Has `Currency` (`USD | EUR | GBP`), `Merchant`, `Payment`. No card type yet.
- `src/data/store.ts` — in-memory store on `globalThis`, seeded once at boot. Writes live until restart; persistence is NWP-203. Cards slot in as a new array here.
- `src/data/merchants.ts` — the merchant list and `merchantById`. The issue form's merchant select reads this.
- `src/data/queries.ts` — allowlist parsing + the one payment query builder. Cards need only simple accessors (`cardsList`, `cardById`), not payment filtering; adding them beside it, not duplicating it.
- `src/lib/money.ts` — `formatMoney` (display) and `parseAmountToMinorUnits` (boundary parse of `"250.00"` → `25000`). Both get reused; no new money code.
- `src/app/api/payments/route.ts` — the route-handler pattern: parse/validate, call queries, `NextResponse.json`.
- `src/app/payments/page.tsx` + `filter-bar.tsx` — the list-page pattern: server component reads queries directly, client islands for interactivity. Table has a written empty state.
- `src/app/payments/[id]/page.tsx` — the detail-page pattern: `notFound()`, `<dl>` fields, UTC + merchant-timezone timestamps.
- `src/components/` — Button, Input, Select, Drawer (Radix dialog), Badge, Table. The issue form uses Drawer; no new primitives.
- `src/components/ui/payments/StatusBadge.tsx` — status badge pattern to extend for card statuses.
- `src/app/siteConfig.ts` + `src/components/ui/navigation/AppSidebar.tsx` — nav lives here; `/cards` needs an entry (lucide `WalletCards`).
- `src/lib/money.test.ts` — vitest style to copy for the Luhn/state-machine tests.
- Ticket-vs-code note: the ticket says "detail shows its spend against the limit" but nothing in the store produces card spend — there is no card-transaction feed. Spend is a `spent` field on the card (minor units), seeded for demo cards and `0` for newly issued ones.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | Cents drift; grader checks this at 20% weight |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit." | `CLAUDE.md`, `.claude/rules/cards.md` | Repo could resemble real PANs |
| "The full number is returned exactly once, in the creation response. After that, last four only." | `.claude/rules/cards.md` | PAN leak; stored records carry last4 + reference only |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal." | `CLAUDE.md` | Cancelled cards come back to life |
| "Validate everything from the client against an allowlist." | `.claude/rules/api-routes.md` | Client-trusted limits — the exact bug in the ticket |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | PAN in client code |

## Approach

Add a `Card` domain: type in `types.ts`, pure helpers in `src/lib/cards.ts` (Luhn generation on the 4242 BIN, masking, transition guard) with tests beside them, a small seed in `src/data/cards.ts`, and accessors in `queries.ts`. Three route handlers own all writes: `GET/POST /api/cards`, `GET /api/cards/[id]`, `POST /api/cards/[id]/status`. The create response is the only payload that ever carries the full number. UI follows the payments pages: a server-rendered `/cards` list with a client Drawer for issuing (success panel shows the number once) and client row actions for freeze/unfreeze via `router.refresh()`, plus a `/cards/[id]` detail with a spend bar that turns amber past 80%.

**Considered and rejected:** deriving spend from a card-transactions array in the store — more "real", but the ticket has no transaction source, it adds seed surface for no scored criterion, and NWP-202/203 own the future of that data. Also rejected: a client-side number generator (banned by `cards.md`) and running cards through the payment query builder (it is payment-shaped; forcing cards through it is the second-implementation smell in reverse).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory` types |
| `src/lib/cards.ts` | add | Luhn check digit + 4242-BIN generator, `maskCard`, state-machine guard |
| `src/lib/cards.test.ts` | add | Unit tests: Luhn validity, BIN, mask, legal/illegal transitions |
| `src/data/cards.ts` | add | Seed cards (one frozen, one past 80% spend) so list/detail render at boot |
| `src/data/store.ts` | change | `cards` array in the store |
| `src/data/queries.ts` | change | `cardsList`, `cardById` accessors |
| `src/app/api/cards/route.ts` | add | GET list (masked), POST create (validated; full number once, 201) |
| `src/app/api/cards/[id]/route.ts` | add | GET detail (masked) |
| `src/app/api/cards/[id]/status/route.ts` | add | POST freeze/unfreeze/cancel with server-side transition guard |
| `src/app/cards/page.tsx` | add | List: table, empty state, issue drawer, row actions |
| `src/app/cards/issue-card-drawer.tsx` | add | Client form → POST → success panel (reveal once) → refresh |
| `src/app/cards/card-actions.tsx` | add | Client freeze/unfreeze without a reload |
| `src/app/cards/[id]/page.tsx` | add | Detail with spend-vs-limit bar, amber past 80% |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Card status badge following `StatusBadge.tsx` |
| `src/app/siteConfig.ts` | change | `cards: "/cards"` base link |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Cards nav item |

## Plan

1. **Domain + helpers + tests** — done when: `npm test` passes with new `cards.test.ts` covering Luhn and transitions.
2. **Store, seed, queries** — done when: `cardsList()` returns seeded cards in a node eval.
3. **API routes** — done when: `curl` shows create-201-with-full-number, list-masked, each validation rejection, and a 409 on `cancelled → active`.
4. **List UI + issue drawer** — done when: issuing in the browser shows the number once and the new card in the list.
5. **Detail + spend bar + freeze/unfreeze** — done when: bar renders amber on the >80% seed card and freeze toggles without a reload.
6. **`/ship-ready`, org-standards pass on the diff, `/northwind-pr`** — done when: checks green, PR open.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: submit drawer, card appears in list. Curl: `POST /api/cards` → 201 |
| Card list at `/cards` | Browser: seeded + created cards with nickname, merchant, `•••• last4`, limit, status, date |
| Card detail | Browser: `/cards/<id>` shows full record + spend vs limit |
| Generated numbers | `cards.test.ts`: starts `4242`, 16 digits, Luhn-valid — `npm test` |
| Reveal once, mask forever | Curl: create response has `fullNumber`; list/detail payloads have only `last4`. Drawer clears it on close |
| Server-side validation | Curl each rejection: missing merchant, zero/negative limit, > 5,000,000, bad currency → 400 |
| State machine (stretch/rule) | `cards.test.ts` transition cases + curl `cancelled → active` → 409 |

## Risks

- Clock. Mitigation: server side first; every core criterion lands before any stretch except tests, which are cheap and first tie-break.
- Reveal-once leak via client state. Mitigation: `fullNumber` lives only in drawer state and is cleared on close; never written to the store.

## Out of scope

- Persistence (NWP-203), auth/roles, real network calls, editing a limit after issue (NWP-202).
- A card-transaction feed; spend is a seeded/zero field (see Current state).

## Open questions

- None blocking. Category lock allowlist chosen as a small fixed set (`ads`, `saas`, `travel`, `office`, `other`) since no ticket source exists.
