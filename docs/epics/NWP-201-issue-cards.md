# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Tiago
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team in Slack, and the platform team creates them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a thread. Marcus Bell wants issuing in the console so the limit is typed once, into a field that validates it, by the person who actually wants the card.

## Current state

Cards do not exist in this codebase. `merchant-console/CLAUDE.md` says so directly: "Cards is NWP-201 and does not exist yet." Everything the feature needs to reuse, however, is already here.

- `src/data/store.ts` — the in-memory store, built once and held on `globalThis` so the dev server's module reloading does not hand a request an empty copy. It has `payments`, `refunds`, `disputes`, `payouts` and no `cards`.
- `src/data/queries.ts` — the one query module. `parseFilters()` is the client allowlist boundary, `paginate()` is generic over `T` and is directly reusable for a card list. `paymentById()` shows the by-id lookup shape.
- `src/lib/money.ts` — `formatMoney()` (the only place a decimal point is allowed to appear), `parseAmountToMinorUnits()` (the string → minor units boundary parser, already rejecting floats and currency symbols). A second parser or formatter for spend limits would be a defect.
- `src/lib/dates.ts` — `formatDate()` for tables (UTC) and `formatInZone()` for detail screens (merchant timezone).
- `src/data/merchants.ts` — `merchants` and `merchantById()`; the merchant allowlist for validation comes from here, not from the client.
- `src/components/ui/payments/StatusBadge.tsx` — a status badge keyed off a union of every status in the app. Card statuses belong in that union; a second badge component would be a duplicate.
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx` — the list-plus-detail server-component pattern, including the written empty state and the pagination controls to mirror.
- `src/app/payments/export-dialog.tsx` — the `"use client"` Drawer-based dialog pattern, with labelled inputs and a disabled-state message.
- `src/lib/money.test.ts` — the colocated vitest pattern. `vitest.config.ts` runs `src/**/*.test.ts` in a node environment, so pure card logic is testable and DOM-free.

Nothing in the ticket contradicts the code. The one gap the ticket does not mention: a card needs a `spent` figure for "spend against the limit" to mean anything, and there is no card spend anywhere to derive it from. Seeded cards carry a deterministic `spent`; newly issued cards start at zero.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units — "$250.00 is 25000" | `CLAUDE.md`, `.claude/rules/money.md` | Cents drift on every limit and every total |
| "The full number appears in the creation response and nowhere else" | `.claude/rules/cards.md` | A PAN sits in a list payload forever |
| "Every generated number starts `4242` and carries a valid Luhn check digit" | `.claude/rules/cards.md` | The repo holds something that resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | The client decides what a card number is |
| `active ⇄ frozen`, either to `cancelled`, `cancelled` terminal — "Guard the transition on the server, not only in the UI" | `.claude/rules/cards.md` | A cancelled card comes back to life from a crafted request |
| "Validate everything from the client against an allowlist" | `.claude/rules/api-routes.md` | A £50,000,000 JPY card exists because the form was bypassed |
| "Write the empty and error states" | `.claude/rules/components.md` | Ops sees a blank table and files a bug |

## Approach

Card logic splits in two. The pure, rule-bearing half — Luhn, the `4242` generator, masking, the state machine, and input validation — goes in `src/lib/cards.ts` beside a colocated `cards.test.ts`, so the four rules that decide most of the score are proven by `npm test` rather than by clicking. The stateful half — issuing, listing, looking up, transitioning — is appended to `src/data/queries.ts`, the existing single query module, reusing its `paginate()` and mirroring its `parseFilters()` allowlist rather than starting a parallel one. Two thin route handlers sit on top: `POST /api/cards` returns the full number exactly once in its `201`, and `PATCH /api/cards/[id]/status` guards the state machine and answers `409` when a transition is illegal. The `Card` record has no field for a PAN at all, which is what makes "reveal once" structural instead of a promise. The UI is a server-component list and detail with two small `"use client"` islands: the issue drawer and the freeze/unfreeze buttons, which refresh via `router.refresh()` rather than reloading the page.

**Considered and rejected:** a separate `src/data/cards.ts` query module. It reads tidier, but `CLAUDE.md` names `queries.ts` as the one query builder and the reviewer weighs second implementations; `paginate()` would have been the first thing copied across. Also rejected: storing the generated PAN on the record and masking at render. It is one line shorter and it is exactly the bug the card rules exist to prevent.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, and the `Card` record — with no PAN field |
| `src/lib/cards.ts` | add | Luhn, `4242` generation, masking, transitions, server-side validation |
| `src/lib/cards.test.ts` | add | Proves the generator and the state machine; the cheapest stretch goal |
| `src/data/cards.ts` | add | Deterministic seed cards so the list, the progress bar, and the amber threshold are visible on first load |
| `src/data/store.ts` | change | `cards` joins the store |
| `src/data/queries.ts` | change | `parseCardFilters`, `queryCards`, `cardById`, `issueCard`, `setCardStatus`, reusing `paginate()` |
| `src/app/api/cards/route.ts` | add | `GET` list (never a PAN), `POST` issue (the one reveal) |
| `src/app/api/cards/[id]/status/route.ts` | add | `PATCH` freeze / unfreeze / cancel, guarded server-side |
| `src/app/cards/page.tsx` | add | `/cards` list with a written empty state |
| `src/app/cards/issue-card-dialog.tsx` | add | The issue form and the one-time reveal screen |
| `src/app/cards/card-actions.tsx` | add | Freeze / unfreeze without a reload |
| `src/app/cards/[id]/page.tsx` | add | Full record and spend against the limit |
| `src/components/ui/payments/StatusBadge.tsx` | change | Card statuses join the existing union |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | Cards in the nav, so the feature is reachable |

## Plan

1. **Types and the card lib, with tests** — done when: `npx vitest run src/lib/cards.test.ts` is green, including 200 generated numbers that all start `4242` and pass Luhn, and every illegal transition rejected.
2. **Store and queries** — done when: the store boots with seeded cards and `queryCards({})` returns them paginated.
3. **Routes** — done when: curl issues a card and gets a `201` carrying a number; the four invalid inputs each get a `400`; `GET /api/cards` contains no `number`; a cancelled card refuses to go back to active with a `409`.
4. **List, detail, and the nav** — done when: `/cards` renders the seeded cards masked and a seeded card's detail shows an amber bar past 80%.
5. **Issue dialog and status actions** — done when: issuing in the browser shows the full number once, and the same card reads `•••• 4242` after a refresh; freeze flips the badge without a page reload.
6. **`/ship-ready`, then `/pr`** — done when: `npm test`, `npm run lint`, and `npm run build` are all green and the description names how each criterion was proven.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill the drawer, submit, the card appears in the list |
| Card list at `/cards` | Browser: all six columns render for seeded and new cards |
| Card detail | Browser: open a card, see the full record and spend against the limit |
| Generated numbers, `4242` BIN, valid Luhn | `src/lib/cards.test.ts` — 200 draws asserted on prefix, length, and Luhn |
| Reveal once, mask forever | curl `GET /api/cards` and the detail route asserted to carry no `number`; browser refresh shows `•••• 4242` |
| Server-side validation | curl each rejection: missing merchant, `0`, `-1`, `5000001`, `JPY` — each a `400` with a message; plus unit tests on `validateCardInput` |
| Freeze / unfreeze (stretch) | Browser: badge flips in place; curl proves `cancelled → active` is a `409` |
| Spend progress, amber past 80% (stretch) | Browser on the seeded high-spend card |
| Category lock (stretch) | Chosen in the drawer, shown on list and detail |
| Tests (stretch) | `npm test` summary pasted into the PR |
| Empty and error states (stretch) | Browser: a filter matching nothing, and a rejected submit rendering the server's message |

## Risks

- **The PAN leaking into a payload.** Mitigated structurally: `Card` has no PAN field, so there is nothing to serialize. The generator returns the number separately and only `POST` passes it on.
- **A float sneaking into a spend limit.** Mitigated by parsing the limit once through the existing `parseAmountToMinorUnits()` at the server boundary and asserting integer minor units in tests.
- **A second query implementation.** Mitigated by appending to `src/data/queries.ts` and reusing `paginate()`.
- **The clock.** Core criteria and the Luhn tests land first; category lock and cancel are the first things cut.

## Out of scope

- Persistence — no database, no ORM, no migrations. Cards vanish on restart. That is NWP-203.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a limit after issue — NWP-202.

## Open questions

- Should a cancelled card stay in the default list view or be filtered out? Building it visible, with a status filter, since ops asking "what happened to that card" is the reason the console exists.
- Is `spent` ever going to come from real payments? Seeded for now; wiring it to the payments store is not in this ticket.
