# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Kadin (with Claude Code)
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants issuing, listing, and inspecting a card to happen in the console instead.

## Current state

- `src/data/types.ts` — defines `Currency = "USD" | "EUR" | "GBP"`, and `Payment.amount` is documented `/** Integer minor units. Never a float. */`. There is **no** `Card` type; cards are a new domain.
- `src/data/store.ts` — the in-memory store: a `Store` interface of `{ merchants, payments, refunds, disputes, payouts }`, built once by `createStore()` and pinned to `globalThis.__northwindStore` so dev-server module reloading does not hand each request a fresh copy. Cards must join this object, not a parallel store.
- `src/data/generate.ts` — generates the seeded payments/refunds/disputes/payouts at boot.
- `src/data/merchants.ts` — `merchants` array and `merchantById(id)`. This is how a merchant reference is validated; no new lookup is needed.
- `src/data/queries.ts` — the payments query builder. `parseFilters()` (lines 18–36) is the repo's worked example of the allowlist rule: client values are checked against a known set *before* they reach a query. Card input validation follows this shape. `paymentById`/`refundsForPayment` show the by-id accessor pattern.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` is "the only place a decimal point appears", plus `parseAmountToMinorUnits(input)` which is explicitly the boundary parser for user input like `"250.00"`. **Both already exist; a second formatter or parser would be a defect.**
- `src/lib/dates.ts` — `formatDate` for display.
- `src/lib/csv.ts` + `src/lib/csv.test.ts`, `money.test.ts`, `dates.test.ts` — the convention is a pure helper in `src/lib/` with a `.test.ts` beside it, run by `vitest` via `npm test`.
- `src/app/api/payments/route.ts` — the route-handler pattern: parse + validate from `request.nextUrl.searchParams`, return `NextResponse.json(...)`. Thin; the logic lives in `src/data/`.
- `src/app/payments/page.tsx` / `src/app/payments/[id]/page.tsx` — list-plus-detail pattern: server components reading from `src/data/`, rendering `src/components/Table` primitives.
- `src/components/Drawer.tsx` — a Radix-dialog-backed modal exporting `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerBody`, `DrawerFooter`, `DrawerClose`. This is the accessible dialog the issue form should use; there is no separate `Dialog.tsx` despite `.claude/rules/components.md` listing one.
- `src/components/ui/payments/StatusBadge.tsx` — maps a status union (`PaymentStatus | DisputeStatus | PayoutStatus`) to a `Badge` variant and dot colour. Card statuses (`active`/`frozen`/`cancelled`) do not collide with any existing member, so this extends rather than being reimplemented.
- `src/app/siteConfig.ts` + `src/components/ui/navigation/AppSidebar.tsx` — nav entries live in both; `/cards` needs adding to each.

**Ticket vs. code:** the ticket says "the full number is shown exactly once, on the success screen". Nothing in the current code stores a PAN at all, so this is a constraint on what the new code may persist, not a behaviour to retrofit.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is **integer minor units**. `$250.00` is `25000`." Format once, at the edge. | `merchant-console/CLAUDE.md`, `.claude/rules/money.md`, ticket rule 1 | Limits drift; a `$250` card is issued for `$2.50` or `$25000` |
| "**Test BIN only.** Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | Repo contains something resembling a real PAN |
| "**Generate on the server.** A card number produced in the browser is a bug." | `.claude/rules/cards.md` | PAN generation is client-observable and trivially forged |
| "**Reveal once.** The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md`, ticket rule 2 | PAN leaks through the list/detail API forever |
| "Mask everywhere else as `•••• 4242`." | `.claude/rules/cards.md` | Inconsistent masking; PAN fragments in the UI |
| "**Status is a state machine.** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md`, ticket rule 3 | A cancelled card gets resurrected by a crafted request |
| "**Validate everything from the client** against an allowlist before it reaches the store, a query, or a filename." | `.claude/rules/api-routes.md` | Unknown currency or a negative limit reaches the store |
| "**Reuse the query builder** … a second implementation is a defect, not a shortcut." | `merchant-console/CLAUDE.md` | Two card lookups that drift apart |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | Client cannot render a useful error |

## Approach

Add cards as a first-class domain that mirrors how payments already work: pure helpers in `src/lib/cards.ts` (Luhn generation on the `4242` BIN, masking, the status-transition table), store access and validation in `src/data/cards.ts` (the single card query builder — issue, list, get, transition), thin route handlers in `src/app/api/cards/` that only parse, delegate, and shape the response, and server-component pages at `/cards` and `/cards/[id]` that read through the same data module. The PAN is generated inside the POST handler's call into `issueCard()`, returned once in that response body, and never written to the stored record — the record holds `last4` and a non-secret `reference` only, which makes reveal-once structural rather than a UI promise.

**Considered and rejected:** generating the number in the client and posting it up (simpler wiring, no round-trip for the reveal) — rejected outright by `.claude/rules/cards.md` ("a card number produced in the browser is a bug") and it would let a caller choose their own PAN. Also rejected: storing the full PAN and masking at render time, which is how most of these features get built and is exactly what rule 2 forbids; masking at render means the PAN is one `console.log` or one API response away from leaking.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `Card`, `CardStatus`, `MerchantCategory` next to the existing domain types |
| `src/lib/cards.ts` | add | Server-side pure helpers: Luhn check digit, `4242`-BIN number generation, the transition table |
| `src/lib/card-display.ts` | add | Client-safe display module: `maskCardNumber`, the category and currency option lists, `categoryLabel`. Separate from the generator so a `"use client"` import cannot pull PAN generation into the browser bundle |
| `src/lib/cards.test.ts` | add | Unit tests beside the helper, per repo convention: BIN prefix, Luhn validity, allowed/blocked transitions |
| `src/data/cards.ts` | add | The one card query builder: `issueCard`, `listCards`, `cardById`, `transitionCard`, plus server-side allowlist validation (`parseIssueCardInput`, `parseCardStatus`) and the limits and allowlists those enforce, derived from the shared option lists |
| `src/data/store.ts` | change | Add `cards: Card[]` to the `Store` interface and `createStore()` |
| `src/data/generate.ts` | change | Seed a few cards so list/detail/progress are demonstrable at boot |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue (returns the PAN exactly once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` one card (masked), `PATCH` status transition, guarded server-side |
| `src/app/cards/page.tsx` | add | `/cards` list: nickname, merchant, masked number, limit, status, created |
| `src/app/cards/issue-card-drawer.tsx` | add | Client: the issue form in the existing `Drawer`, plus the one-time reveal success screen |
| `src/app/cards/card-status-actions.tsx` | add | Client: freeze/unfreeze/cancel via `PATCH` + `router.refresh()` — no full page reload |
| `src/app/cards/[id]/page.tsx` | add | Card detail: full record, spend against limit, amber past 80% |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend the existing status union with card statuses rather than writing a second badge |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | `/cards` nav entry |

## Plan

1. **Types + pure helpers + tests** — `Card`/`CardStatus` in `types.ts`; `src/lib/cards.ts` with `luhnCheckDigit`, `generateCardNumber`, `maskCardNumber`, `canTransition`. Done when: `npm test` passes with new cases proving the `4242` prefix, Luhn validity over many generations, and that `cancelled` is terminal.
2. **Store + data module** — `cards` on the store, seeded; `src/data/cards.ts` with validation and the four operations. Done when: `listCards()` returns seeded cards and `parseIssueCardInput` rejects each bad input in a unit test or a REPL check.
3. **Routes** — `GET`/`POST /api/cards`, `GET`/`PATCH /api/cards/[id]`. Done when: `curl` issues a card and gets a `number` back; a second `GET` of that card returns `last4` and **no** `number`; a bad currency returns `400` with a message.
4. **List page + issue drawer** — `/cards` with the table and the form; success screen reveals once. Done when: submitting the form in the browser adds a row and shows the PAN once; reopening the drawer shows no PAN.
5. **Detail page + spend progress** — `/cards/[id]` with the record and the bar. Done when: a seeded card over 80% renders amber.
6. **Freeze/unfreeze + nav + empty/error states** — Done when: toggling status updates the row without a full reload, and `/cards` with no cards renders written copy.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Submit the drawer form in the browser; the new row appears in `/cards` |
| Card list at `/cards` | Screenshot showing nickname, merchant, masked number, limit, status, created date |
| Card detail | Open a card; full record plus spend-against-limit renders |
| Generated numbers, server-side, `4242` BIN + Luhn | `src/lib/cards.test.ts`: asserts prefix and Luhn over 200 generations. Generation stays out of the client bundle because the generator lives in `src/lib/cards.ts` while the client imports display helpers from `src/lib/card-display.ts` — the two are deliberately separate modules |
| Reveal once, mask forever | node `fetch` POST shows `number`; a `GET` of the same card has no `number` field; UI shows `•••• <last4>` in list and detail, and the number is absent from the DOM once the success screen closes |
| Server-side validation | node `fetch` with missing merchant / `0` / `-1` / `5000001` / non-integer / `"JPY"` / empty nickname each returns `400` and a message |
| Stretch: merchant category lock | Chosen in the drawer, validated against the allowlist in `parseIssueCardInput`, rendered on the detail page via `categoryLabel()`. Drawer and detail read from the same option list, so the labels cannot drift |
| Stretch: freeze/unfreeze without reload | Click freeze in the list; badge changes with no navigation |
| Stretch: spend progress amber past 80% | Seeded card at >80% renders the amber bar |
| Stretch: tests | `npm test` output |
| Stretch: empty + error states | `/cards` with an emptied store; form submit with a bad value shows the server's message |

## Risks

- **Reveal-once regressing through a convenience field.** Mitigation: the stored `Card` type simply has no `number` field, so a leak cannot compile.
- **Client-side-only state guard.** Mitigation: `transitionCard` rejects illegal transitions in `src/data/cards.ts`; the UI only hides buttons as a courtesy.
- **Clock.** Core criteria first in the order above; stretch goals only after step 5 is verified.

## Out of scope

- Persistence — NWP-203. The store stays in memory; cards vanish on restart, as designed.
- Editing a limit after issue — NWP-202.
- Auth, roles, real card-network calls.

## Open questions

- Card `spend` is modelled as a stored minor-units field on the card rather than derived from payments, since no payment in the seed references a card. If spend should later be derived, `cardById` is the single place that changes.
