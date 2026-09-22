<!--
Title: NWP-201: issue virtual cards from the console
-->

## Ticket

Closes NWP-201

## What changed

Ops can now issue a virtual card from the console instead of messaging the platform team. A drawer on `/cards` takes a nickname, merchant, spend limit, currency, and an optional category lock; submitting generates the number on the server and the card appears in the list. `/cards` lists every issued card and `/cards/[id]` opens one to show its full record and its spend against the limit. Cards can be frozen, unfrozen, and cancelled from either place. The full card number is shown once, on the success screen, and never again — only the last four is stored.

**Server and data layer**

- `src/lib/cards.ts` — Luhn check digit, `4242`-BIN number generation, `maskCardNumber`, and the status transition table. Pure, no store access.
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
- [ ] Checked it in the browser — **not verified by me.** The API and the test suite are verified as below; the rendered pages are not part of this evidence.

`npm test` — **41 tests passing across 4 files.** 13 are new in `src/lib/cards.test.ts`: Luhn validity over 200 consecutive generations, the `4242` BIN prefix and 16-digit length on every one, `lastFour` and `maskCardNumber`, and every legal and illegal status transition including `cancelled` as terminal.

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

- [x] **Freeze and unfreeze from the list.** `src/app/cards/card-status-actions.tsx`. The `PATCH` transitions are verified at the API. The no-full-reload behaviour uses `router.refresh()` — **not browser-verified.**
- [x] **Spend progress, amber past 80%.** `src/app/cards/[id]/page.tsx`. The seeded card `Meta Ads — Q3` sits at 431,200 of 500,000 (86%) so it exercises the amber path. **Rendering not browser-verified.**
- [x] **Merchant category lock.** Chosen at issue time in the drawer, validated against an allowlist in `parseIssueCardInput`, shown on the detail page.
- [x] **Tests.** `src/lib/cards.test.ts`, beside the code it covers, `npm test` passing.
- [x] **Empty and error states.** Written empty state in `src/app/cards/page.tsx`; the drawer and status actions render the server's own error message rather than a generic one. **Not browser-verified.**

## Bugs fixed along the way

None. No defect outside the ticket was found or fixed in this branch.

## Notes for the reviewer

- **Reveal-once is structural, not a UI promise.** `Card` has no `number` field, so a leak through a list or detail payload cannot compile rather than merely being avoided. The client holds the number in component state only until the success screen closes.
- **The state machine is enforced in `transitionCard`, not in the buttons.** The UI hides illegal actions as a courtesy; `PATCH` rejects them with `409` regardless of what the client sends.
- **One query builder.** All card reads and writes go through `src/data/cards.ts`. `StatusBadge` was extended rather than duplicated, and money is formatted only by the existing `formatMoney` / `parseAmountToMinorUnits` helpers in `src/lib/money.ts`.
- **Boot hazard worth knowing about, not a bug in this branch.** `src/data/store.ts` pins the store to `globalThis.__northwindStore` so dev-server module reloading does not hand out a fresh copy. Adding `cards` to the `Store` shape therefore does not take effect on an already-running dev server — the cached object has no `cards` array and every card route 500s until the server restarts. Restarting resolves it. Anyone adding a new collection to the store will hit the same thing.
- **Spend is a stored field on the card**, not derived from payments, since no seeded payment references a card. If spend should be derived later, `cardById` is the single place that changes.
- **Not done:** the browser pass. The API surface and the suite are verified; the rendered pages are not.

### Out of scope

Persistence (NWP-203) — cards live in the in-memory store and vanish on restart, as designed. Editing a limit after issue (NWP-202). Auth, roles, permissions. Real card-network calls.
