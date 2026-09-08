# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** vkofia@doximity.com (via /spec)
**Status:** draft

## Problem

Ops issues virtual cards by pinging platform in Slack. Twelve to twenty times a week, hours per request, and last month two cards shipped with the wrong spend limit because the ask was buried in a thread. Merchants use these for vendor subs, ad spend, and contractor tools, and they need a limit from the moment the card exists. Reporter is Marcus Bell (Head of Merchant Ops).

Move issuance into the console so ops can do it themselves, see what they have issued, and open a card to check it.

## Current state

Nothing about cards exists in this codebase yet. Every piece has to be built, but the patterns to follow are all here.

- `src/data/store.ts:16` — the `Store` interface has `merchants`, `payments`, `refunds`, `disputes`, `payouts`. No `cards` array. The store is held on `globalThis.__northwindStore` so HMR does not blow it away, and `createStore()` at line 29 hydrates from `generate()`.
- `src/data/types.ts` — has `Payment`, `Refund`, `Dispute`, `Payout`. No `Card` type. Every existing record uses integer minor units and a currency string, which is the pattern the card limit follows.
- `src/data/generate.ts` — seeds `payments`, `refunds`, `disputes`, `payouts`. Does not seed cards. Cards can start as `[]` at boot; there is no existing card data to preserve.
- `src/data/queries.ts:18` — `parseFilters()` is the reference allowlist pattern (`STATUSES.includes(...)`, early defaults, return validated object). Card create validation follows this shape.
- `src/app/api/payments/route.ts` and `src/app/api/payments/export/route.ts` — the only two API routes today. Both are `GET`. There is no existing `POST` or `PATCH` route in the app, so the card create and freeze/unfreeze/cancel actions establish that pattern.
- `src/app/api/payments/export/route.ts` — the freshest validation example. `Parsed<T>` discriminant, `badRequest(message)` returning `Response.json({ error }, { status: 400 })`, reject early. Card routes should use the same error shape.
- `src/lib/money.ts` — `formatMoney(minor, currency)`, `parseAmountToMinorUnits(input)`, `sumMinorUnits(amounts)`, `formatMoneyCompact(minor, currency)`. `parseAmountToMinorUnits` returns `null` on invalid input and is exactly what the card limit form needs.
- `src/lib/dates.ts` — `formatDate(iso)` for tables, `utcDayKey(iso)` for bucketing. Card `createdAt` follows the existing UTC ISO string pattern.
- `src/components/` — `Button`, `Input`, `Select`, `Drawer` all exist. No `Dialog` primitive. Drawer is Radix-Dialog-backed and a11y-correct; it is what NWP-101 used for the export options and what the card create form should use.
- `src/app/payments/export-dialog.tsx` — freshest client-component-with-form example: `"use client"`, Drawer surface, `useState` for form fields, disabled submit when invalid. Card create form follows the same shape but posts JSON to the route instead of building a download href.
- `src/components/ui/navigation/AppSidebar.tsx` — the `navigation` array (~line 26) lists Overview / Payments / Disputes / Payouts. Adding Cards is one entry plus one icon import.
- `src/app/siteConfig.ts:5` — `baseLinks` has `overview`, `payments`, `disputes`, `payouts`. No `cards`. One line to add.

**Ticket-vs-code mismatches:**
- The ticket says "Store the last four and the generated number's reference." No reference table exists. The pragmatic read is: store `last4` on the card record, generate the full number once, return it in the create response body, never persist the full number. No separate reference table needed for this ticket.
- The ticket asks the card detail to show "spend against the limit." No transaction is linked to a card anywhere in the store. See Open questions.

## Domain rules

Quoted, not paraphrased.

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures." | `.claude/rules/cards.md` | Scoring penalty; reputational risk in a fictional demo that suddenly looks like a real card |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Client tampering; number leaks in devtools |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | PAN persists somewhere it can be re-read |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | Cancelled cards come back to life via a crafted request |
| "Amounts are integer minor units. `$250.00` is `25000`. Never store, compare, or accumulate an amount as a float." | `.claude/rules/money.md` | Cent drift on totals |
| "Every amount travels with its currency code." | `.claude/rules/money.md` | Cross-currency sums that look right and are wrong |
| "Validate everything from the client against an allowlist before it reaches the store, a query, or a filename." | `.claude/rules/api-routes.md` | Store poisoning, unbounded input |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | UI has to speak two error dialects |
| "Never return a full card number from a list or detail route." | `.claude/rules/api-routes.md` | Same as reveal-once |
| Ticket validation: reject missing merchant, zero or negative limit, limit above 5,000,000 minor units, currency outside `USD`, `EUR`, `GBP`, and category outside the four-value allowlist. | NWP-201 core criteria plus category decision below | Bad data lands in the store, ops trusts a broken record |

## Approach

Add a `Card` type and a `store.cards: Card[]` slice starting empty. Build one client-generator (`src/lib/cards.ts`) for the 16-digit `4242`-prefixed Luhn-valid number, exported alongside a status-transition helper so both can be unit-tested next to their code. Wire up two route handlers: `POST /api/cards` (validate, generate the number server-side, push to store, return the created card with the full number as a one-time field) and `PATCH /api/cards/[id]` (accept a target status, guard the transition, return the updated masked card). Add `/cards` list + `/cards/[id]` detail pages using the existing Table primitives, and a Drawer-based create form on the list page that posts JSON to `POST /api/cards`. Success screen for the reveal is the same Drawer swapping bodies after submit; the full number lives in local state only until the drawer closes.

**Considered and rejected:** a dedicated `/cards/new` route instead of a drawer form. Rejected because the export-dialog pattern is already established, cards is the second Drawer-based form and consistency is worth more than the modest UX gain of a full page, and the reveal screen fits naturally as a second view of the same drawer. The extra route also fights the sidebar's "Cards" entry pointing to the list.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `CardCategory`, `Card` interfaces (id, merchantId, nickname, spendLimit, spend, currency, category, status, last4, createdAt). `spend` is integer minor units, initialized to `0`, same currency as `spendLimit`. `category` is one of `"retail" \| "marketplace" \| "subscription" \| "services"` |
| `src/data/store.ts` | change | Add `cards: Card[]` to the `Store` interface and to `createStore()` (initialized `[]`) |
| `src/data/cards.ts` | add | `cardById(id)`, `cardsByMerchant(id)` lookups — mirrors `merchantById` |
| `src/lib/cards.ts` | add | `generateCardNumber()` (4242 BIN + 11 random digits + Luhn check), `isValidLuhn(digits)`, `mask(last4)`, `canTransition(from, to)` state-machine guard, and `CARD_CATEGORIES` allowlist consumed by the form Select, the POST validator, and the list/detail renderers |
| `src/lib/cards.test.ts` | add | Unit tests: Luhn checksum validity of generated numbers, 4242 prefix invariant, state machine allowed/disallowed transitions. Stretch criterion. |
| `src/app/api/cards/route.ts` | add | `POST` handler: validates payload against allowlist, generates number, appends to store, returns `{ card, cardNumber }` |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` handler: reads target status, guards transition via `canTransition`, updates store, returns masked card; 404 on unknown id, 409 on illegal transition |
| `src/app/cards/page.tsx` | add | Server component listing every issued card (nickname, merchant, masked number, limit, status, created date) with the empty state written, not defaulted |
| `src/app/cards/[id]/page.tsx` | add | Server component showing one card's record. Renders spend against limit (see Open questions) |
| `src/app/cards/issue-drawer.tsx` | add | Client component: create form (nickname, merchant, limit, currency, category), then reveal screen after success. Local state only, cleared on close |
| `src/app/cards/freeze-button.tsx` | add | Client component for freeze/unfreeze from the list (stretch); fetch PATCH, `router.refresh()` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | One entry in the `navigation` array with a card icon from `lucide-react` |
| `src/app/siteConfig.ts` | change | Add `cards: "/cards"` to `baseLinks` |

## Plan

Sequenced so each step ends somewhere verifiable. Stop and check before moving on.

1. **Types and store.** Add `Card` and `CardStatus` to `src/data/types.ts`, extend `Store` in `src/data/store.ts` with `cards: [] as Card[]`. Add `src/data/cards.ts` with lookup helpers. *Done when:* `npx tsc --noEmit` is clean and `store.cards` compiles.
2. **Generator + state machine + tests.** Write `src/lib/cards.ts` (`generateCardNumber`, `isValidLuhn`, `canTransition`, `mask`) and `src/lib/cards.test.ts`. *Done when:* `npm test` passes with new tests, and every generated number in a loop of 100 passes `isValidLuhn` and starts with `4242`.
3. **POST /api/cards.** Add the route handler with allowlist validation (merchant exists in `store.merchants`, currency in `["USD","EUR","GBP"]`, `spendLimit` an integer between 1 and 5_000_000). *Done when:* `curl -X POST` with a good body returns `{ card, cardNumber }` and the store has one more card; with a bad body returns 400 with the expected error message.
4. **Sidebar + `/cards` list.** Update `siteConfig`, add the sidebar entry, build the list page reading from `store.cards`, render the "no cards yet" empty state. *Done when:* the sidebar shows Cards, `/cards` returns 200, and a card created via the API in step 3 appears in the list, masked.
5. **Issue drawer.** Build the client component with the four inputs, submit → POST, on success swap to the reveal screen showing the full number once. Close resets local state. *Done when:* clicking Issue opens the drawer, submitting creates the card, the number is shown once and no longer available after close.
6. **`/cards/[id]` detail.** Server component showing the card record. Spend renders as `spend / limit` and a progress indicator per the Open question resolution. *Done when:* opening a card from the list shows its record, masked, with the spend line.
7. **PATCH /api/cards/[id] + freeze/unfreeze button (stretch).** Route handler guards transitions; button posts and calls `router.refresh()`. *Done when:* freezing then unfreezing a card round-trips without a page reload, and `cancelled → active` returns 409.
8. **Ship-ready and PR.** `npm test`, then `/ship-ready`, then commit `NWP-201:` prefixed, push to fork, open the cross-repo PR filled from the template.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card from a form/dialog | Click Issue on `/cards`, fill in nickname/merchant/limit/currency, submit, watch the card appear in the list |
| `/cards` list with the required columns | Load `/cards` after step 3, confirm every column renders |
| Card detail with full record and spend against limit | Click a row, confirm the record fields are present and the spend line renders |
| Server-side number generation, 4242 BIN, valid Luhn | `src/lib/cards.test.ts` asserts both invariants against 100 generated numbers |
| Reveal once, mask forever | The create route's response body includes `cardNumber`; the list and detail responses/pages only include `last4`. Verified by `curl` on `POST /api/cards`, then `GET /api/cards` (if added) or by reading the page HTML |
| Server-side validation of missing merchant / limit range / currency allowlist | `curl -X POST` with each bad payload returns 400 with the corresponding error |
| Freeze/unfreeze without page reload (stretch) | Click freeze on a card in the list, badge flips, no full navigation. `PATCH /api/cards/[id]` returns 200 |
| Spend progress bar amber past 80% (stretch) | Set a card's limit and spend so ratio > 0.8, confirm the bar's color class |
| Merchant category lock (stretch) | Category Select on the issue form uses `CARD_CATEGORIES`. `curl -X POST` with `category: "bogus"` returns 400. The list row and detail page render the chosen category. Verified end-to-end in step 5 (form) and step 6 (detail) |
| Tests on Luhn generator and state transitions (stretch) | `npm test` output shows the new file |
| Empty and error states written (stretch) | `/cards` before any card exists shows a deliberate "No cards yet — Issue one" empty; the drawer shows the API error message below the submit button on 400 |
| `npm test` passes at the end | Runs cleanly with the new cards.test.ts included |

## Risks

- **Time.** The ticket is 45 minutes and eight points. Landing all core criteria plus tests is realistic if step 2 (generator + state machine) does not blow up. If the clock is tight, cut PATCH/freeze and merchant category first; they are stretch.
- **Number reveal leaking.** The full number must not survive after the drawer closes. Local state only, cleared on close. No `localStorage`, no query params, no logs. The list and detail routes must never include a `cardNumber` field.
- **State transition drift.** A `canTransition(from, to)` helper that both the UI and the server call is the safe shape; if the UI diverges, the server still enforces.
- **Validation surface.** Merchant IDs are client-supplied. Reject anything not in `store.merchants`. Do not trust client currency or limit type.

## Out of scope

- Persistence (NWP-203). Cards vanish on dev-server restart. Do not add a database, ORM, or migration.
- Editing a card's limit after issue (NWP-202).
- Authentication, roles, permissions.
- Real card network calls.

## Decisions

- **Spend attribution: default to zero.** `Card.spend` is an integer minor units field on the record, initialized to `0` on issue, same currency as `spendLimit`. Nothing populates it today; future tickets are on the hook for linking transactions. The card detail renders `$0.00 of $X · 0%` on day one, and the stretch progress bar / 80% threshold work the moment `spend` is written from somewhere. If a demo of a filled bar is needed later, seed one card with non-zero `spend` in `generate.ts`.
- **Merchant category lock: card-level allowlist of four.** The category is a `Card.category` field (not a `Merchant` field — merchants in the seed data have no category attribute today). Allowlist is `["retail", "marketplace", "subscription", "services"]`, exported as `CARD_CATEGORIES` from `src/lib/cards.ts` so the form Select, the POST allowlist validator, and the list/detail renderers all read from one source. The category is required on issue, shown on the card list row, shown on detail, and validated server-side.

## Open questions

- None outstanding. Both prior open questions resolved in Decisions above.
