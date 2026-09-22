# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** hdunbar@mycervello.com
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants issuing, listing, and inspecting a card to happen in the console instead.

## Current state

This is greenfield. `grep` for `interface Card`, `type Card`, `luhn`, `CardStatus`, and `spendLimit` across `src/` returns nothing — `.claude/rules/cards.md` describes rules for code that does not exist yet.

- `src/data/types.ts` — has `Merchant`, `Payment`, `Refund`, `Dispute`, `Payout`, `Currency`, `PaymentFilters`. No `Card`, no `CardStatus`. `Payment` stores `last4` and `cardBrand` and never a full number, which is the masking precedent to copy.
- `src/data/store.ts:16-22` — the `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. No `cards` array. The store is pinned to `globalThis.__northwindStore` (lines 36-38) so the dev server's module reloading does not hand each request a fresh copy — writes must mutate this object, not a copy.
- `src/data/generate.ts:69` — `generate()` returns the four collections, deterministically, via `mulberry32(SEED)` (line 32) anchored to `GENERATED_AT` (line 58). `generatePayouts` stores `gross`, `fees`, and `net` as computed aggregates on the record — the precedent for storing a card's spend rather than deriving it from a transaction model that does not exist.
- `src/app/api/` — only `payments/route.ts` and `payments/export/route.ts`, both `GET`. **There is no write route in this app yet**; issuing a card adds the first `POST`.
- `src/data/queries.ts:19-36` — `parseFilters` is the in-repo precedent for an allowlist gate: it checks status, sort, and direction against fixed lists and falls back rather than trusting input.
- `src/lib/money.ts` — `formatMoney` and `sumMinorUnits`, plus `parseAmountToMinorUnits`, whose docstring reads "Parse user input like `250` or `250.00` into minor units. Boundary only." It has **no callers anywhere in `src/`** — it was written for a form like this one.
- `src/app/disputes/page.tsx` — the simplest top-level route precedent: reads `store` directly, sorts, renders a `Table`. `/cards` should look like this, not like `/overview`.
- `src/app/siteConfig.ts` — `baseLinks` lists overview, payments, disputes, payouts. **No cards entry.**
- `src/components/ui/navigation/AppSidebar.tsx:26-50` — the `navigation` array is `as const` and reads from `siteConfig.baseLinks`. Note the `CreditCard` icon is already taken by Payments, so Cards needs a different one.
- `src/components/ui/payments/StatusBadge.tsx` — `AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus`, backed by three **exhaustive** `Record<AnyStatus, …>` maps (`LABELS`, `DOTS`, `VARIANTS`). Adding card statuses without adding all three entries is a compile error, not a runtime surprise. `Badge` offers `default | neutral | success | error | warning`.
- `src/components/` — has `Drawer` (the Radix dialog this codebase calls a drawer), `Input`, `Select`, `Button`, `Table`, `Badge`. **No progress-bar or meter component exists**, so the spend bar is hand-built from Tailwind.

**Where the ticket and the code disagree:** the rules say to store "the last four and the generated number's reference." No "reference" concept exists anywhere in the codebase — `Payment` carries only `last4` and `cardBrand`. That term needs defining rather than assuming (see Open questions).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`." | ticket §Rules 1, `.claude/rules/money.md` | A limit stored as `250` under-limits the card by 100× |
| "Never return a full card number from a list or detail route. The full number exists in exactly one response, the creation one." | `.claude/rules/api-routes.md` | Reveal-once collapses; a PAN-shaped value becomes re-readable |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md`, ticket §Rules 4 | Something in this repo resembles a real PAN |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life from a crafted request |
| "Validate everything from the client against an allowlist before it reaches the store." | `.claude/rules/api-routes.md` | Currency and limit arrive unchecked; the ticket names the exact bounds |

## Approach

Add a `Card` to the data layer, seed a handful deterministically so the list, detail, and spend bar are demonstrable on a fresh dev server, and put the card rules — Luhn generation, the status machine, and the validation gate — in `src/lib/cards.ts` with tests beside it, so the route handlers stay thin. The full number is generated server-side, returned once in the creation response, and never written to the store: the record keeps `last4` plus an opaque reference. Spend is a stored aggregate on the card, following how `Payout` already stores `gross`/`fees`/`net`; cards ops issues start at zero.

**Considered and rejected:** deriving spend from a card-transaction collection. It would be the honest model, but there is no transaction concept in this codebase, NWP-203 puts persistence out of scope, and inventing one costs the clock without changing anything the ticket asks to see.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | Add `Card` and `CardStatus`; limit and spend in minor units, with a currency |
| `src/data/store.ts` | Change | Add `cards` to the `Store` interface and `createStore` |
| `src/data/generate.ts` | Change | Seed deterministic cards, some with spend past 80%, so the bar and the states are visible |
| `src/lib/cards.ts` | Add | Luhn generation on the `4242` BIN, masking, the status-transition guard, and the issue validation gate |
| `src/lib/cards.test.ts` | Add | Unit tests for the generator and the transitions — the ticket's Tests stretch goal |
| `src/app/api/cards/route.ts` | Add | `POST` to issue. The one response that carries a full number |
| `src/app/api/cards/[id]/route.ts` | Add | `PATCH` for freeze/unfreeze/cancel, guarded by the state machine |
| `src/app/cards/page.tsx` | Add | The `/cards` list, modelled on `src/app/disputes/page.tsx` |
| `src/app/cards/issue-dialog.tsx` | Add | Drawer form: nickname, merchant, limit, currency; success screen reveals the number once |
| `src/app/cards/[id]/page.tsx` | Add | Detail, with spend against limit |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Extend `AnyStatus` and all three exhaustive maps with the card statuses |
| `src/app/siteConfig.ts` | Change | Add the `cards` base link |
| `src/components/ui/navigation/AppSidebar.tsx` | Change | Add the Cards nav entry with an icon that is not `CreditCard` |

## Plan

1. **Model and seed** — `Card`/`CardStatus` in types, `cards` in the store, deterministic seed cards in `generate.ts`. Done when: `/api/payments` still responds and the seeded cards are readable from a scratch query.
2. **`src/lib/cards.ts` + tests** — Luhn generator, mask, transition guard, issue validation. Done when: the tests cover a generated number passing Luhn and starting `4242`, and every illegal transition being refused.
3. **`POST /api/cards`** — validates merchant, limit (>0, ≤5,000,000), and currency against the allowlist; generates server-side; returns the full number exactly once. Done when: `curl` with a bad merchant, a zero limit, a limit over the cap, and `JPY` each return 400, and a valid request returns a number starting `4242` that is absent from any subsequent read.
4. **`/cards` list and nav** — route, table, `StatusBadge` extension, sidebar entry. Done when: the seeded cards render masked with limit and status, and Cards appears in the sidebar.
5. **Issue dialog** — Drawer form posting to the route, with the one-time reveal on success. Done when: issuing from the browser adds a row and shows the full number once; reopening the card shows only `•••• 4242`.
6. **Detail and spend** — `/cards/[id]` with the record and a spend bar that turns amber past 80%. Done when: a seeded high-spend card renders amber and a fresh card renders empty.
7. **Stretch, in order** — freeze/unfreeze from the list without a reload; empty and error states; category lock if the clock allows.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: submit the dialog, the row appears in the list |
| Card list at `/cards` | Browser: nickname, merchant, masked number, limit, status, created date all render |
| Card detail with spend | Browser: open a seeded card, confirm the record and the spend figure |
| Generated numbers, `4242` BIN + Luhn | `cards.test.ts`: generated numbers start `4242` and pass a Luhn check |
| Reveal once, mask forever | `curl` the creation response for the number, then `curl`/open every read path and confirm it is absent |
| Server-side validation | `curl`: missing merchant, `0`, negative, `5000001`, and `JPY` each return 400 with a safe message |
| Status transitions (rules) | `cards.test.ts`: `cancelled` refuses every transition; `active ⇄ frozen` allowed |

## Risks

- **The reveal is easy to leak by accident.** A single careless spread of the generated card object into a response or the store breaks the rule. Mitigate by never assigning the full number onto the stored record at all — generate it, use it for `last4` and the response, and let it fall out of scope.
- **`StatusBadge`'s exhaustive maps** will fail the build if only one of the three is updated. That is the good failure mode; it just needs doing in one pass.
- Seeded cards change `generate()`'s output. Nothing asserts on card counts today, but existing payment-derived figures must stay untouched.

## Out of scope

- Persistence — NWP-203. No database, ORM, or migration; the store is in memory on purpose.
- Editing a card's limit after issue — NWP-202.
- Authentication, roles, permissions; real card-network calls.

## Open questions

- **What is "the generated number's reference"?** The ticket's rule 2 says to store it, but no such concept exists in the codebase. Proposing an opaque `reference` string on the card (a `cardref_…` id) that stands in for where a real issuer's token would go — it is stored, it is not the PAN, and nothing can reconstruct the number from it. Worth confirming that is what the reporter meant.
- **Does cancel need UI in this pass?** No acceptance criterion asks for it, but rule 3 defines `cancelled` and calls it terminal. Planning to implement the transition in the guard and expose it only if the clock allows, since the guard is where the rule actually bites.
- **Currency: the card's or the merchant's?** Each `Merchant` in `src/data/merchants.ts` carries its own `currency`, and the form takes a currency separately. Planning to let ops pick, defaulting to the selected merchant's, and validating against `USD`/`EUR`/`GBP` regardless — but a card in a currency the merchant does not trade in may be nonsense worth refusing.
