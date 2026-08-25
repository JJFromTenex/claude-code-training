# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Rytham Dawar
**Status:** draft
**Contract:** [NWP-201-contract.md](NWP-201-contract.md) — the frozen signatures and file ownership the parallel lanes build against

## Problem

Ops issues virtual cards by messaging the platform team in Slack, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a thread. Marcus Bell wants issuing in the console: issue a card, see the cards issued, open one to check it.

## Current state

Cards do not exist anywhere in this codebase yet. Everything below is the shape the feature has to copy.

- `src/data/types.ts` — `Currency`, `Merchant`, `Payment` and friends. No `Card`, no `CardStatus`. `Payment.amount` is documented as "Integer minor units. Never a float."
- `src/data/store.ts` — the in-memory store on `globalThis.__northwindStore`, built once by `createStore()` from `generate()`. `Store` has `merchants | payments | refunds | disputes | payouts`. A `cards` array has to be added to both the interface and `createStore()`.
- `src/data/generate.ts:69` — `generate()` produces the seeded records; `GENERATED_AT` (line 58) is the fixed clock the seed uses.
- `src/data/queries.ts:18` — `parseFilters()` is the pattern for server-side allowlisting: read params, check against a `readonly` list, fall back to a default. `queryPayments()` (line 102) and `paymentById()` (line 108) are the read helpers pages call directly.
- `src/lib/money.ts` — `formatMoney()`, `sumMinorUnits()`, and **`parseAmountToMinorUnits()`**, which already turns `"250"` / `"250.00"` into minor units and returns `null` on anything else. This is the only place client amount input gets converted. Do not write a second one.
- `src/lib/dates.ts` — `formatDate()` (line 31) and `formatInZone()` (line 22). Lists use `formatDate`; detail pages use `formatInZone` with the merchant timezone (`src/app/payments/[id]/page.tsx:9`).
- `src/app/api/payments/route.ts` — the whole route handler is four lines: parse via the allowlist helper, return `NextResponse.json`. Cards routes match this.
- `src/app/payments/page.tsx` — server component, reads `queryPayments()` **directly** (not via fetch), renders `TableRoot`/`Table` from `src/components/Table.tsx`. `src/app/payments/filter-bar.tsx` is the `"use client"` island beside it. Cards list follows the same split.
- `src/components/ui/payments/StatusBadge.tsx` — one badge keyed on a union `AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus`, with `LABELS`/`DOTS`/`VARIANTS` maps. **Extend this union with `CardStatus`; a second badge component is the "second implementation" the rubric penalises.**
- `vitest.config.ts` — `environment: "node"`, `include: ["src/**/*.test.ts"]`. Tests are `.ts` only: **a `.tsx` component test will not be collected.** Luhn and transition tests must live in a `.ts` file.
- `src/components/` — `Input.tsx`, `Select.tsx`, `Button.tsx`, `Badge.tsx`, `Table.tsx`, `Drawer.tsx`.

**Where the docs and the code disagree:** `.claude/rules/components.md` says "`src/components/` already has Button, Input, Select, **Dialog**". There is no `Dialog.tsx`. `src/components/Drawer.tsx` is the wrapper over `@radix-ui/react-dialog` (focus trap, Escape, overlay all included). Use `Drawer` for the issue form; do not add a Dialog component to make the rule true.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge" | `merchant-console/CLAUDE.md` | A limit stored as `250` or `"$250.00"`; cents drift on the spend bar |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit" | `merchant-console/CLAUDE.md`, `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| "**Generate on the server.** A card number produced in the browser is a bug" | `.claude/rules/cards.md` | Client-side generation; unverifiable numbers |
| "The full number is returned exactly once, in the creation response. After that, last four only" | `merchant-console/CLAUDE.md` | A full PAN in the store, in a list payload, or left in client state |
| "Mask everywhere else as `•••• 4242`" | `.claude/rules/cards.md` | Inconsistent masking |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. **Guard the transition on the server**, not only in the UI" | `.claude/rules/cards.md` | A cancelled card comes back to life via curl |
| "Validate on the server… checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md`, `.claude/rules/api-routes.md` | Client-trusted currency or limit |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user" | `.claude/rules/api-routes.md` | Ops sees a stack trace |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone" | `merchant-console/CLAUDE.md` | `createdAt` written in local time |
| No database, no ORM, no migrations — persistence is NWP-203 | ticket + `CLAUDE.md` | Zero points, lost clock |

## Approach

Add cards as a fourth resource alongside payments, refunds, disputes and payouts, following the existing seam exactly: types in `src/data/types.ts`, a `cards` array on the store, one read/write module `src/data/cards.ts` playing the role `queries.ts` plays for payments, and pure card logic (Luhn generation, masking, transition guard) in `src/lib/cards.ts` with `src/lib/cards.test.ts` beside it — the same shape as `money.ts`/`money.test.ts`. The store holds only `last4`, `brand` and a `reference`; the full number exists solely in the `POST /api/cards` response body and is rendered on a success screen that drops it from client state on close. The list and detail pages are server components reading `src/data/cards.ts` directly (like `payments/page.tsx`), with two small `"use client"` islands: the issue Drawer and the freeze/unfreeze buttons, both of which POST/PATCH and then call `router.refresh()` so the server component re-renders without a full page reload.

**Considered and rejected:** putting validation in the Drawer and having the route trust it. Cheaper to write and it demos identically, but `.claude/rules/api-routes.md` is explicit that "client-side checks are a convenience, never the enforcement", and server-side validation is an explicit core criterion worth part of the 20% correctness weight. Client checks stay, as a convenience, on top of the server ones.

**Also rejected:** a `CardStatusBadge` component. `StatusBadge`'s `AnyStatus` union already exists to be extended.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `MerchantCategory`, `Card` (`spendLimit` minor units + `currency`, `spent`, `last4`, `reference`, `createdAt` UTC), `CardInput` |
| `src/lib/cards.ts` | add | `generateCardNumber()` on the `4242` BIN with Luhn check digit, `luhnCheck()`, `maskLast4()`, `canTransition(from, to)` — pure, no store access |
| `src/lib/cards.test.ts` | add | Luhn validity + `4242` prefix over many generations; every legal and illegal transition, including `cancelled` terminal |
| `src/data/cards.ts` | add | `listCards()`, `cardById()`, `createCard(input)`, `setCardStatus(id, next)`, and `parseCardInput(body)` — the allowlist, modelled on `parseFilters` in `queries.ts:18` |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store` and to `createStore()` |
| `src/data/generate.ts` | change | Seed a handful of cards (mixed statuses, one past 80% spend) so the list, the badge and the progress bar have something to show. **Additive only — never edit seed data to make a case pass** |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` create → the one and only full-number response |
| `src/app/api/cards/[id]/route.ts` | add | `GET` one card, masked |
| `src/app/api/cards/[id]/status/route.ts` | add | `PATCH` freeze / unfreeze / cancel, guarded by `canTransition` |
| `src/app/cards/page.tsx` | add | `/cards` list: nickname, merchant, masked number, spend limit, status, created date + written empty state |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record, spend against limit, progress bar amber past 80%, `notFound()` on miss |
| `src/app/cards/issue-card-form.tsx` | add | `"use client"` Drawer form (nickname, merchant, limit, currency, category) → `POST` → success screen showing the full number once |
| `src/app/cards/card-actions.tsx` | add | `"use client"` freeze/unfreeze buttons → `PATCH` → `router.refresh()` |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add `CardStatus` to `AnyStatus` with labels, dots and variants for `active`/`frozen`/`cancelled` |
| `src/app/siteConfig.ts` | change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add the Cards nav item using `siteConfig.baseLinks.cards` |

## Plan

Server first. Nothing in the UI gets written until `curl` proves the routes.

1. **Types + store + seed** — done when: `npm run build` type-checks with `Card` on the store and seeded cards present.
2. **`src/lib/cards.ts` + its test** — done when: `npm test` passes, asserting 1,000 generated numbers all start `4242` and satisfy `luhnCheck`, and that `canTransition` allows `active↔frozen`, allows both to `cancelled`, and rejects everything out of `cancelled`.
3. **`src/data/cards.ts`** — done when: `createCard` rejects a missing merchant, `<= 0`, `> 5_000_000`, and any currency outside `USD|EUR|GBP`; the stored record has no full number on it.
4. **The three route handlers** — done when: `curl -X POST /api/cards` returns `201` with a full number, `curl /api/cards` shows the same card with `last4` only and no full number anywhere in the body, the four invalid bodies each return `400` with a user-safe `message`, and `PATCH .../status` returns `409` for `cancelled → active`.
5. **Read the diff.** Minor units end-to-end? No second money parser? Validation on the server? Do this before a single component exists.
6. **`/cards` list + sidebar link** — done when: the page renders seeded cards masked, with a written empty state, and Cards appears in the nav.
7. **Issue form + reveal-once success screen** — done when: submitting adds a row without a manual reload, the full number appears once, and closing the Drawer clears it from state (reopening shows the form, not the number).
8. **Card detail + spend progress** — done when: `/cards/<id>` shows the record and a bar that goes amber past 80%.
9. **Freeze/unfreeze from the list** — done when: the row's badge flips without a full page reload.
10. **`npm test`, `/ship-ready`, `/northwind-pr`, push.**

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Fill the Drawer in the browser; the row appears in `/cards` without a manual reload. Screenshot |
| Card list at `/cards` | Browser: all six columns present — nickname, merchant, `•••• 4242`, limit, status, created date |
| Card detail | Click a row; full record plus spend-against-limit renders. Screenshot |
| Generated numbers, `4242` BIN + Luhn | `src/lib/cards.test.ts` — prefix and `luhnCheck` over 1,000 generations, via `npm test` |
| Reveal once, mask forever | `curl -s -X POST /api/cards -d '…'` shows the full number; `curl -s /api/cards` and `curl -s /api/cards/<id>` piped through `grep` show no 16-digit string. Close and reopen the Drawer in the browser to confirm it is gone from client state |
| Server-side validation | Four `curl` calls with a missing merchant, `0`, `5000001`, and `"JPY"` — each `400` with a message |
| State machine | `src/lib/cards.test.ts` on `canTransition`, plus `curl -X PATCH` on a cancelled card returning `409` |
| Money in minor units | `grep` the diff for `toFixed`/`parseFloat` outside `src/lib/money.ts`; every amount travels with its currency |
| Freeze/unfreeze (stretch) | Click freeze in the list; badge changes, no full reload |
| Spend progress (stretch) | Seeded card past 80% renders amber |
| Empty and error states (stretch) | Temporarily empty the seed array in memory to view the empty state; submit an invalid limit to view the error |

## Risks

- **Clock.** 45 minutes. Steps 1–6 are the score; steps 7–9 are the tie-break. If time runs short, stop after step 8 and write the PR description — the description is worth 10% and a stretch goal is worth 5%.
- **Reveal-once leaking.** The easiest way to fail 20% of the rubric is a `fullNumber` field that survives into the store or into a list payload. Mitigated by step 4's `grep` check on the response bodies before any UI exists.
- **`router.refresh()` in a server-component list.** If the refresh does not pick up the store write, the fallback is a `"use client"` list island fetching `GET /api/cards` — but that duplicates a read path, so try `refresh()` first.
- **Vitest ignores `.tsx`.** `include: ["src/**/*.test.ts"]`. Keep testable logic in `src/lib/cards.ts`, not in a component.

## Out of scope

- Persistence, ORM, migrations — NWP-203. The store stays in memory.
- Auth, roles, permissions.
- Real card network calls.
- Editing a spend limit after issue — NWP-202. The detail page shows the limit read-only.
- Card-level filtering/pagination. `/cards` is a plain list; if it ever needs filters they go through a builder, not a second one.

## Open questions

- **Where does `spent` come from?** The ticket requires "its spend against the limit" but there are no card transactions and building them is not in scope. Plan assumes a `spent` field on `Card`, seeded to a plausible value on seeded cards (one deliberately past 80%) and `0` on newly issued ones. The alternative — deriving spend from `store.payments` — would mean inventing a payment↔card link the seed does not have. Flag if you disagree; it is a one-line change either way.
- **Does `/cards` start seeded or empty?** Plan seeds a few, because an empty list proves nothing about the list rendering. The written empty state is still built and verified separately.
