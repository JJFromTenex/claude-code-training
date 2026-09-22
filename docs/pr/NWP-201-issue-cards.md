<!--
Title: NWP-201: issue virtual cards from the console
-->

## Ticket

Closes NWP-201

## What changed

Ops can now issue a virtual card from the console instead of messaging the platform team. A drawer on `/cards` takes a nickname, merchant, spend limit, currency, and an optional category lock; submitting generates the number on the server and the card appears in the list. `/cards` lists every issued card and `/cards/[id]` opens one to show its full record and its spend against the limit. Cards can be frozen, unfrozen, and cancelled from either place. The full card number is shown once, on the success screen, and never again — only the last four is stored.

**Server and data layer**

- `src/lib/cards.ts` — Luhn check digit, `4242`-BIN number generation, and the status transition table. Pure, no store access, server-side only.
- `src/lib/card-display.ts` — client-safe display concerns: `maskCardNumber`, `categoryLabel`, and the category/currency option lists. Kept apart from the generator so a client component cannot pull PAN generation into the browser bundle; `src/data/cards.ts` derives its server-side allowlists from these same lists, so the form and the validator cannot disagree.
- `src/lib/cards.test.ts` — unit tests beside the code they cover.
- `src/data/cards.ts` — the single card query builder: `parseIssueCardInput` (server-side allowlist validation), `issueCard`, `listCards`, `cardById`, `transitionCard`.
- `src/data/types.ts` — `Card`, `CardStatus`, `MerchantCategory`.
- `src/data/store.ts`, `src/data/generate.ts` — `cards` joins the in-memory store, with three seeded cards so the list, detail, and spend progress have something to show at boot.

**Routes**

- `src/app/api/cards/route.ts` — `GET` list (masked), `POST` issue. The `POST` response is the only place the full number exists.
- `src/app/api/cards/[id]/route.ts` — `GET` one card (masked), `PATCH` status, guarded by the state machine.

**UI**

- `src/app/cards/page.tsx` — the list, with a written empty state.
- `src/app/cards/issue-card-drawer.tsx` — the issue form and the one-time reveal screen.
- `src/app/cards/card-status-actions.tsx` — freeze / unfreeze / cancel.
- `src/app/cards/[id]/page.tsx` — card detail and the spend bar.
- `src/components/ui/payments/StatusBadge.tsx` — extended with the three card statuses rather than adding a second badge component.
- `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` — `/cards` nav entry.

## How I verified it

- [x] `npm test` passes
- [x] New behavior is covered by a test
- [x] Checked it in the browser

Browser pass at `localhost:3000/cards`, driven with Playwright:

- Opened the drawer, selected a merchant from the listbox, submitted. The card was created and the full number was revealed once on the success screen (`4242 5784 0418 0197`), with the masked form `•••• 0197` shown beside it.
- After closing the success screen, the full number is **gone from the DOM** — re-checked with a regex over `document.body.textContent`. Reveal-once holds in the browser, not just in the payloads.
- Submitting with no merchant chosen shows the written error `Select a merchant.` and keeps the form open.
- `€1234.56` typed into the limit field arrives as `123456` minor units.
- Nested-portal check: with the merchant listbox open, Escape closes the popover and leaves the drawer open. Focus returns to the trigger.
- The list re-renders with the new card via `router.refresh()`, no full page reload.

`npm test` — **75 tests passing across 5 files**, 47 new for this ticket. Broken down in the Tie-breaks section below.

`npx tsc --noEmit` — clean, exit 0.

Live checks against the running dev server:

- `POST /api/cards` with valid input returned `201` with a 16-digit number on the `4242` BIN that passes Luhn. The returned `card` record has no `number` key, and its `last4` matches the number's last four.
- `GET /api/cards` and `GET /api/cards/:id` were both checked for the string `"number"` in the response body. Neither contains it.
- `PATCH /api/cards/:id` — `active→frozen`, `frozen→active`, `active→cancelled` all returned `200` with the new status. `cancelled→active` and `cancelled→frozen` both returned `409` with `"A cancelled card cannot change status."`
- `GET /api/cards/card_999999` returned `404` `"Card not found."`
- `PATCH` with an unknown status returned `400` `"Status must be one of active, frozen, cancelled."`

Server-side validation — each of these returned `400` with a message safe to show a user:

| Input | Response |
| --- | --- |
| Missing merchant | `Merchant is required.` |
| Unknown merchant id | `Unknown merchant.` |
| Zero limit | `Spend limit must be greater than zero.` |
| Negative limit | `Spend limit must be greater than zero.` |
| Limit above 5,000,000 | `Spend limit must be 5000000 minor units or less.` |
| Non-integer limit | `Spend limit must be a whole number of minor units.` |
| Currency outside USD/EUR/GBP | `Currency must be one of USD, EUR, GBP.` |
| Empty nickname | `Nickname is required.` |

## Acceptance criteria

### Core

- [x] **Issue a card.** Drawer form takes nickname, merchant, spend limit, currency — `src/app/cards/issue-card-drawer.tsx`, posting to `src/app/api/cards/route.ts`. Verified at the API; the list re-renders via `router.refresh()`.
- [x] **Card list.** `/cards` shows nickname, merchant, masked number, spend limit, status, created date — `src/app/cards/page.tsx`.
- [x] **Card detail.** Full record plus spend against limit — `src/app/cards/[id]/page.tsx`.
- [x] **Generated card numbers.** Server-side on the `4242` BIN with a valid Luhn digit — `generateCardNumber` in `src/lib/cards.ts`, called only from `issueCard` in `src/data/cards.ts`. Covered by test and confirmed against the live route.
- [x] **Reveal once, mask forever.** The number is returned only by `POST /api/cards` and is deliberately absent from the `Card` type, so there is no field to read it back from. Confirmed absent from both `GET` payloads.
- [x] **Server-side validation.** `parseIssueCardInput` in `src/data/cards.ts`; all eight rejection cases confirmed above.

### Stretch

- [x] **Freeze and unfreeze from the list.** `src/app/cards/card-status-actions.tsx`. `PATCH` transitions verified at the API; the no-full-reload path uses `router.refresh()` and was confirmed in the browser.
- [x] **Spend progress, amber past 80%.** `src/app/cards/[id]/page.tsx`. The seeded card `Meta Ads — Q3` sits at 431,200 of 500,000 (86%), rendering the amber bar; `role="progressbar"` with `aria-valuenow` for screen readers.
- [x] **Merchant category lock.** Chosen at issue time, validated against the allowlist in `parseIssueCardInput`, shown on the detail page. The drawer and the detail page read the same option list, so their labels cannot drift.
- [x] **Tests.** `src/lib/cards.test.ts` and `src/data/cards.test.ts`, each beside the code it covers. 75 passing, 47 new. See Tie-breaks.
- [x] **Empty and error states.** Written empty state in `src/app/cards/page.tsx`; the drawer and status actions surface the server's own message rather than a generic one. The `Select a merchant.` path was exercised in the browser.

## Tie-breaks

### Tests

**75 passing across 5 files**, 47 of them new for this ticket.

- `src/lib/cards.test.ts` (13) — the pure helpers: Luhn validity over 200 consecutive generations, `4242` prefix and 16-digit length on every one, check-digit maths against the canonical test PAN, masking, and the full transition table including `cancelled` as terminal and same-state transitions rejected.
- `src/data/cards.test.ts` (34) — the server-side guards the rules actually ride on: `parseIssueCardInput` against 14 hostile inputs (non-object body, `null`, blank and over-long nicknames, missing and unknown merchants, zero/negative/over-max/non-integer/string limits, unsupported and lowercase currencies, unknown category), the exact `5000000` boundary accepted, **mass-assignment rejected** (client-supplied `status`, `spend`, `id`, `last4` are dropped), `parseCardStatus`, and `transitionCard` proving `cancelled` is terminal, that an illegal transition never mutates the store, and that a missing card reports rather than throws.
- `issueCard` is asserted to store only `last4` — `JSON.stringify(card)` is checked not to contain the generated number, and the `reference` is checked not to contain the number or even the last four.

### Keyboard and screen-reader behaviour

Audited in the browser, not assumed. Verified working:

| Behaviour | Result |
| --- | --- |
| Issue button reachable and operable by keyboard | Focusable; opens the drawer |
| Focus moves into the dialog on open | Yes |
| Dialog has an accessible name and description | `Issue a virtual card` + description via `aria-describedby` |
| Escape closes the drawer | Yes, and **focus returns to the trigger** |
| Escape inside an open select | Closes the popover only, drawer stays open |
| Select opens from the keyboard | `ArrowDown` opens the listbox, focus moves into the options, `aria-expanded` flips |
| Every form control resolves to a label | 5/5, checked by resolving accessible names the way a screen reader does |
| Errors announced | `role="alert"` on both the drawer and the row actions |
| Spend bar | `role="progressbar"` with `aria-valuenow/min/max` and a label |
| Headings | `h1` → `h2`, no skipped levels |
| Buttons with no discernible text | None |

**One real defect found and fixed here.** In the list, every row rendered buttons named only "Freeze" and "Cancel". A screen-reader user pulling up a button list or tabbing the table heard the same two names 65 times with no way to tell which card they belonged to. The row actions now take the card's nickname and expose `Freeze card <nickname>` / `Cancel card <nickname>` as their accessible names, while the visible label stays short. Re-verified: names are now unique per row.

### Diff size

Two feature commits plus this one. The change reuses rather than adds: `formatMoney` / `parseAmountToMinorUnits` (`src/lib/money.ts`), `formatDate` (`src/lib/dates.ts`), the existing `StatusBadge` (extended by three statuses rather than duplicated), `Table`, `Drawer`, `Input`, `Button`, and `Select`. No new dependencies. The only new modules are the ones the ticket requires: the card domain, its two routes, and its two pages.

## Bugs fixed along the way

Three, all found by review and verification rather than by the feature work itself. Worth naming because two of them passed every API-level check:

1. **The issue dialog never opened.** The trigger was a bare `<Button onClick>` rendered as a child of `Drawer`. Every API test passed and the form was unreachable in a browser — the defect was invisible to anything that did not actually click. Fixed by wrapping it in `DrawerTrigger asChild`, which also restores `aria-haspopup`/`aria-expanded` and focus return on close.
2. **`reference` was derived from the card number.** It was `cref_${hash(number)}` — a 32-bit non-cryptographic hash of the PAN, stored permanently on the record. That narrows a ~10¹¹ search space to roughly 23 candidate numbers, which is the opposite of what "never persist the full card number" is for. Now generated from `crypto.getRandomValues`, unrelated to the number.
3. **The PAN generator shipped in the client bundle.** `issue-card-drawer.tsx` is a `"use client"` module and imported `maskCardNumber` from `src/lib/cards.ts`, pulling `generateCardNumber` and the Luhn helpers into the browser chunk alongside it. Nothing generated client-side, so the rule's letter held, but the generator was being served to the browser. Split: generation stays in `src/lib/cards.ts`, display helpers moved to `src/lib/card-display.ts`.

## Notes for the reviewer

- **Reveal-once is structural, not a UI promise.** `Card` has no `number` field, so a leak through a list or detail payload cannot compile rather than merely being avoided. The client holds the number in component state only until the success screen closes.
- **The state machine is enforced in `transitionCard`, not in the buttons.** The UI hides illegal actions as a courtesy; `PATCH` rejects them with `409` regardless of what the client sends.
- **One query builder.** All card reads and writes go through `src/data/cards.ts`. `StatusBadge` was extended rather than duplicated, and money is formatted only by the existing `formatMoney` / `parseAmountToMinorUnits` helpers in `src/lib/money.ts`.
- **Boot hazard worth knowing about, not a bug in this branch.** `src/data/store.ts` pins the store to `globalThis.__northwindStore` so dev-server module reloading does not hand out a fresh copy. Adding `cards` to the `Store` shape therefore does not take effect on an already-running dev server — the cached object has no `cards` array and every card route 500s until the server restarts. Restarting resolves it. Anyone adding a new collection to the store will hit the same thing.
- **Spend is a stored field on the card**, not derived from payments, since no seeded payment references a card. If spend should be derived later, `cardById` is the single place that changes.
- **Components.** The issue form uses the repo's own `Select` rather than raw `<select>`. Radix renders a hidden native select inside a form, so the existing `FormData` read still works without controlled state. `required` was moved off those three fields and into `onSubmit`, because Radix puts `required` on a `tabIndex={-1}` hidden control and browsers cannot report a validation message on one.
- **One inline `style`** remains, on the spend bar's width in `src/app/cards/[id]/page.tsx` — a runtime percentage cannot be a JIT Tailwind class. The repo does the same in `Drawer.tsx`, `BarChart.tsx`, and `ComboChart.tsx`.

### Out of scope

Persistence (NWP-203) — cards live in the in-memory store and vanish on restart, as designed. Editing a limit after issue (NWP-202). Auth, roles, permissions. Real card-network calls.
