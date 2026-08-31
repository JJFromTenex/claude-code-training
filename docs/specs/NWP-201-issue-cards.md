# SPEC · NWP-201 — Issue virtual cards from the console

> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** sejla.ali@openasset.com
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Merchants need these cards for vendor subscriptions, ad spend, and contractor tools, and they need a spend limit from the moment the card exists. Marcus Bell wants the whole thing in the console: issue a card, see the cards issued, open one to check it.

## Current state

Cards do not exist in this application yet. `merchant-console/CLAUDE.md` says so directly: "Cards is NWP-201 and does not exist yet". A grep for `card`/`luhn` across `src/` finds only payment *method* data (`Payment.cardBrand`, `Payment.last4` in `src/data/types.ts:31-33`) and CSV export columns — no card entity, no `/cards` route, no number generation.

What exists and must be reused rather than reinvented:

- `src/data/queries.ts` — the payments query builder. `parseFilters` (line 19) allowlist-validates client input; `filterPayments`/`sortPayments`/`paginate`/`queryPayments` (lines 73-134) are the shape a card query module should copy, and `paginate` (line 115) is already generic over `T`.
- `src/data/store.ts` — the in-memory `Store` interface (line 16) and `createStore` (line 29), held on `globalThis` so dev-server reloads do not reset it.
- `src/lib/money.ts` — `parseAmountToMinorUnits` (line 51) is the one boundary parser for user-entered amounts; `formatMoney` (line 15) is the display formatter. A second parser is a defect.
- `src/lib/dates.ts` — `formatDate` (line 31) and `formatInZone` (line 22) for UTC storage and merchant-timezone display.
- `src/app/payments/page.tsx` — the list-page pattern: server component, filters from `searchParams`, `Table` primitives, an empty-state row, pagination via `Link`.
- `src/app/payments/[id]/page.tsx` — the detail-page pattern: `notFound()` guard (line 21), local `Field` helper for a `<dl>` grid (line 127).
- `src/app/payments/export-dialog.tsx` — the only dialog in the app; Radix `DialogPrimitives` composed inline with Tailwind. There is no zod and no react-hook-form in `package.json`; validation is hand-written allowlist functions and forms are native inputs with `useState`.
- `src/components/ui/payments/StatusBadge.tsx` — despite its folder, already generic across three status unions (line 5), driven by three `Record` lookup maps.
- `src/data/merchants.ts` — ten fixed merchants, each with a `currency` and IANA `timezone`; `merchantById` at line 90.

**Where the ticket and the code disagree:** the ticket lists "spend against the limit" under Core but there is no transaction system anywhere in this app, and real card-network calls are explicitly out of scope. So spend cannot be computed from anything — it has to be a field on the record, `0` at issue time, with no writer. The Core criterion is then satisfied honestly (the detail page shows spend against limit); the Stretch item is the bar-with-amber-threshold rendering on top of it.

Also worth noting: `merchant-console/CLAUDE.md` says "Seed data is JSON, loaded into a store module at boot", but there are no JSON files in `src/data/` — `generate.ts` is a deterministic generator. Nothing for this ticket depends on it.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge" | `merchant-console/CLAUDE.md` | Cents drift on every limit and total |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures" | `.claude/rules/cards.md` | A repository full of things that look like real card numbers |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | Number generation sitting in a client bundle |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md` | Card data leaking from any later read |
| "Mask everywhere else as `•••• 4242`" | `.claude/rules/cards.md` | Inconsistent, untrustworthy display |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI" | `.claude/rules/cards.md` | A cancelled card comes back to life via a crafted request |
| "Validate on the server. Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md` | The incident this ticket exists to prevent, in a new form |
| "One query builder... A second implementation is a bug, not a shortcut" | `merchant-console/CLAUDE.md` §3 | Two filter paths that disagree |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone" | `merchant-console/CLAUDE.md` §2 | Cards appear created on the wrong day |
| "Use what is here... Tailwind only. No inline `style` attributes" and "Write the empty and error states" | `.claude/rules/components.md` | Divergent UI, dead-end screens |

## Approach

Build the server completely before any UI exists, and check it with `curl` and unit tests at that boundary. The card entity joins `src/data/types.ts` with no `number` field at all — the absence is the enforcement mechanism for reveal-once, because there is no field for a later read to leak. Pure Luhn/BIN/masking/state-machine logic goes in `src/lib/cards.ts` (matching the `src/**/card*.ts` glob in `.claude/rules/cards.md`) so it is testable with no store and no server. Store-touching queries and the two mutations go in `src/data/cards.ts`, mirroring `queries.ts` and reusing its generic `paginate`. Two route handlers stay thin. Only then does the UI get built: a list page, a Radix dialog whose success screen is the single place a full number is ever rendered, and a detail page — all mirroring their payments equivalents, with the transition table shared between the server guard and the buttons so the UI cannot offer an illegal move.

**Considered and rejected:** putting the card query functions into `src/data/queries.ts` alongside the payment ones, which is where current precedent points since there is no `src/data/payments.ts`. Rejected because `queries.ts` is already 147 lines and mixing a second entity's reads *and* the app's first mutations into it makes the "one query builder" rule harder to see, not easier. A separate `src/data/cards.ts` keeps the mirror obvious and also lands the card logic inside the `cards.md` rule glob. Also rejected: deriving `spent` from a generated transaction ledger, which would invent scope the ticket excludes.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `Card` (no `number` field, by design), `CardFilters` |
| `src/lib/cards.ts` | add | Luhn check digit, 4242 generation, masking, transition table — pure, no store |
| `src/lib/cards.test.ts` | add | BIN and Luhn over many generated numbers; every transition pair |
| `src/data/store.ts` | change | `cards: Card[]` on the `Store`, empty at boot |
| `src/data/cards.ts` | add | Card query builder plus `createCard`/`transitionCardStatus`, all validation |
| `src/data/cards.test.ts` | add | Every rejection the ticket names, the cap boundary, no-number-in-record |
| `src/app/api/cards/route.ts` | add | `GET` list; `POST` issues and returns the number once |
| `src/app/api/cards/[id]/route.ts` | add | `GET` masked detail; `PATCH` status transition |
| `src/app/cards/page.tsx` | add | The `/cards` list, status filters, both empty states |
| `src/app/cards/issue-dialog.tsx` | add | The issue form and the reveal-once success screen |
| `src/app/cards/status-actions.tsx` | add | Freeze/unfreeze/cancel, refreshing in place |
| `src/app/cards/[id]/page.tsx` | add | Card detail, spend against limit, controls |
| `src/components/ui/payments/StatusBadge.tsx` | change | Three card statuses added to the existing union and maps |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | `/cards` in the sidebar |

## Plan

Sequenced so each step ends somewhere verifiable. Steps 1-5 are the server; no UI is written until step 5 passes.

1. **Card types** — done when: `tsc --noEmit` is clean and `Card` has no field that could hold a full number.
2. **`src/lib/cards.ts` and its test** — done when: `npm test` shows generated numbers starting `4242` and passing Luhn across hundreds of samples, and every legal and illegal transition pinned.
3. **Store and `src/data/cards.ts`** — done when: unit tests cover every rejection the ticket names, and a failed validation leaves the store untouched.
4. **Both route handlers** — done when: `tsc` and `next lint` are clean.
5. **Server checkpoint (`curl` against `npm run dev`)** — done when: `POST` returns a 16-digit `4242` Luhn-valid number that appears in neither `GET /api/cards` nor `GET /api/cards/[id]`; each invalid input returns 400 with a field-named message; `active↔frozen` and either→`cancelled` return 200 while anything out of `cancelled` returns 400.
6. **List page and issue dialog** — done when: a card issued through the dialog appears in the list masked, and the full number is absent from the DOM after the dialog closes and after reopening it.
7. **Detail page and status controls** — done when: the record, spend against limit, and only the legal controls render; freezing updates the row without a page load.
8. **Sidebar and badge wiring** — done when: `/cards` is reachable from the sidebar and card statuses render as badges.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card (nickname, merchant, limit, currency) | Playwright drives the dialog against the running app; the card appears in the list |
| Card list at `/cards` with nickname, merchant, masked number, limit, status, created date | `curl localhost:3000/cards` returns 200 and the row renders all six columns; screenshot |
| Card detail shows the full record and spend against the limit | `src/app/cards/[id]/page.tsx` rendered in-browser; asserts `Spend against limit` present |
| Numbers generated server-side on the 4242 BIN with a valid Luhn digit | `src/lib/cards.test.ts` over 200 samples, plus an independent Luhn implementation in the Playwright check on the revealed number |
| Reveal once, mask forever | `data/cards.test.ts` asserts the serialized record never contains the number; Playwright asserts it is gone from the DOM after close and does not return on reopen; `grep -cE '4242[0-9]{12}'` on the list and detail HTML is 0 |
| Server-side validation: missing merchant, zero/negative limit, limit above 5,000,000, currency outside USD/EUR/GBP | 31 cases in `src/data/cards.test.ts`, plus `curl` against each route confirming 400 and not 500 |
| *Stretch* freeze/unfreeze without a full reload | Playwright clicks Freeze and asserts a Frozen badge and an Unfreeze control appear without navigation |
| *Stretch* spend progress, amber past 80% | `role="progressbar"` with `aria-valuenow` on the detail page; amber class applied at ≥80% |
| *Stretch* merchant category lock | Chosen in the dialog, asserted on the record in `data/cards.test.ts`, shown on the list row and detail page |
| *Stretch* tests | `npm test` — 79 passing |
| *Stretch* written empty and error states | Two distinct empty states asserted in-browser on a fresh store vs. a filter matching nothing; the dialog's inline error asserted on an empty submit |

Commands: `npm test`, `npx tsc --noEmit`, `npm run lint`, then `npm run dev` with the `curl` checkpoint and the Playwright walk.

## Risks

- **The reveal-once rule is easy to break later.** Mitigated structurally: `Card` has no number field, so a future list or detail route has nothing to leak. A test asserts the serialized record never contains the number.
- **`spent` is always `0`.** It is a real field with no writer because nothing spends in this app. If a reviewer reads the progress bar as fake, the honest answer is that it is wired to a real field awaiting a transactions ticket.
- **In-memory store resets on restart.** Expected and documented in `store.ts`; cards issued during a demo vanish when the dev server restarts. Persistence is NWP-203.
- **The `4242` BIN means generated numbers collide with the payments seed's `last4`.** Harmless here, but card search by last four can match a card that shares four digits with another.

## Out of scope

- Persistence, a database, an ORM, migrations — NWP-203.
- Editing a card's limit after issue — NWP-202.
- Authentication, roles, permissions.
- Real card-network calls; there is no issuer.
- The uncommitted CSV export work in the tree (column and scope selection) belongs to NWP-101 and is not touched by this ticket.

## Open questions

- Should `spent` ever be writable before a transactions feature exists, e.g. seeded with a plausible amount so the progress bar has something to show in a demo? Recommendation: no — a fabricated spend figure in an ops tool is worse than a truthful zero.
- Should issuing a card be blocked for an `elevated` risk-tier merchant? `Merchant.riskTier` exists in `src/data/types.ts:21` and nothing in the ticket mentions it. Recommendation: leave it alone until Ops asks.
