# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** /spec
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. That takes hours, happens 12–20 times/week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Merchants use these cards for vendor subscriptions, ad spend, and contractor tools. They need a limit from the moment they exist.

## Current state

- `src/data/types.ts` — defines `Payment`, `Refund`, `Dispute`, `Payout`, `Merchant`, and `Currency`. No `Card` type exists.
- `src/data/store.ts` — `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. No `cards` field. Uses `globalThis.__northwindStore` to survive Next.js module reloads.
- `src/data/generate.ts` — seed data pattern: deterministic PRNG, sequential IDs padded with `pad(n, width)`, ISO 8601 UTC timestamps. No card generation.
- `src/app/siteConfig.ts` — `baseLinks` lists `overview`, `payments`, `disputes`, `payouts`. No `cards` entry.
- `src/components/ui/navigation/AppSidebar.tsx` — `navigation` array drives the sidebar. Adding Cards requires a new entry here and in `siteConfig`.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` for display; `parseAmountToMinorUnits(input)` for parsing user input at the boundary. Both are required for spend-limit handling.
- `src/lib/dates.ts` — `formatDate(iso)` for table columns (UTC); `formatInZone(iso, timezone)` for merchant-timezone display on detail pages.
- `src/components/Drawer.tsx` — the only dialog/panel primitive; built on `@radix-ui/react-dialog`. The issue-card form lives here.
- `src/components/ui/payments/StatusBadge.tsx` — `StatusBadge` maps status values to badge variants. Card statuses (`active`, `frozen`, `cancelled`) are not yet present and need to be added.
- `src/app/payments/[id]/page.tsx` — reference pattern for a detail page: `notFound()` guard, `Field` helper component, merchant-timezone display.
- `src/app/payments/page.tsx` — reference pattern for a list page with server-side data fetching.

**No Luhn generator exists.** It must be written in `src/lib/cards.ts` and tested beside it.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units | `CLAUDE.md` | `$250.00` limit stored as `250` means 400× underspend |
| Generate card numbers server-side | `cards.md` | Number produced in browser is a bug; `4242` BIN is not optional |
| Full number returned once only | `cards.md` | Leaking a PAN in list/detail responses |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled` (terminal) | `cards.md` + ticket | Invalid transitions accepted silently |
| Validate everything from the client | `api-routes.md` | Unsanitised merchant ID, currency, or limit reaches the store |
| No database, no ORM, no migrations | `CLAUDE.md` | Out-of-scope and costs clock time |

## Approach

Add a `Card` type and `cards` array to the store, a Luhn generator in `src/lib/cards.ts`, four API routes (`POST /api/cards`, `GET /api/cards`, `GET /api/cards/[id]`, `PATCH /api/cards/[id]/status`), two pages (`/cards` list, `/cards/[id]` detail), and an `IssueCardDrawer` client component that contains the issue form. The creation response is the only place the full number appears; it is shown in a one-time success screen inside the drawer, not stored in the card record. The sidebar and siteConfig get a Cards entry.

**Considered and rejected:** A modal (`@radix-ui/react-dialog` directly) instead of the existing `Drawer`. The `Drawer` component already handles overlay, animation, focus management, and close behaviour — using it avoids reinventing accessible dialog semantics and keeps the pattern consistent with the rest of the console.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | Add `Card` type with `id`, `merchantId`, `nickname`, `last4`, `spendLimit`, `currency`, `status`, `category?`, `createdAt` |
| `src/data/store.ts` | Change | Add `cards: Card[]` to `Store` interface and `createStore`; extend `globalThis` declaration |
| `src/lib/cards.ts` | Add | Luhn generator: `generateCardNumber()` → 16-digit string starting `4242` with valid check digit; `last4FromNumber(pan)` helper |
| `src/lib/cards.test.ts` | Add | Unit tests: Luhn validity of generated numbers, `4242` BIN enforcement, last-four extraction |
| `src/app/api/cards/route.ts` | Add | `GET` returns all cards (last4 only, no PAN); `POST` validates input, generates number server-side, stores card, returns full number once |
| `src/app/api/cards/[id]/route.ts` | Add | `GET` returns card detail (last4 only); `PATCH` validates and applies status transition |
| `src/app/cards/page.tsx` | Add | Server component: card list table — nickname, merchant, `•••• last4`, limit, status, created date |
| `src/app/cards/[id]/page.tsx` | Add | Server component: card detail — all fields, spend progress bar (stretch), timeline stub |
| `src/app/cards/issue-card-drawer.tsx` | Add | `"use client"` — `Drawer` wrapping the issue form; on success, shows full number in a one-time reveal screen before clearing it from state |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Add `active`, `frozen`, `cancelled` to `LABELS`, `DOTS`, and `VARIANTS` maps |
| `src/app/siteConfig.ts` | Change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | Change | Add Cards nav entry with a card icon |

## Plan

1. **Add `Card` type** to `src/data/types.ts` and `cards: Card[]` to `src/data/store.ts` — done when TypeScript compiles with no errors (`npx tsc --noEmit`).
2. **Write and test the Luhn generator** in `src/lib/cards.ts` and `src/lib/cards.test.ts` — done when `npm test` passes and every generated number starts `4242` and passes a Luhn check.
3. **Add the API routes** (`POST /api/cards`, `GET /api/cards`, `GET /api/cards/[id]`, `PATCH /api/cards/[id]/status`) with server-side validation — done when `curl -X POST /api/cards` with valid and invalid bodies returns `201` and `400` respectively, and the creation response includes the full PAN while `GET /api/cards` returns only last four.
4. **Build the card list page** at `src/app/cards/page.tsx` — done when `/cards` renders an empty-state message when no cards exist, and issued cards appear in the table.
5. **Build `IssueCardDrawer`** with the issue form and one-time reveal screen — done when submitting the form opens the success screen showing the full number, and closing it navigates to the list where only `•••• last4` is shown.
6. **Build the card detail page** at `src/app/cards/[id]/page.tsx` — done when `/cards/card_000001` renders all fields correctly and shows `notFound()` for an unknown ID.
7. **Extend `StatusBadge`** for `active`/`frozen`/`cancelled`, add Cards to `siteConfig` and the sidebar — done when the Cards link appears in the sidebar and badges render with the correct colour.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card; it appears in the list | Fill form → submit → close reveal screen → card visible in `/cards` table |
| Card list shows nickname, merchant, masked number, limit, status, date | Inspect `/cards` table columns |
| Card detail shows full record and spend against limit | Open a card → `/cards/[id]` renders all fields; spend shows `0 / limit` |
| Numbers on `4242` BIN with valid Luhn | `npm test` — Luhn test asserts validity; BIN test asserts prefix |
| Full number shown exactly once | Visible on success screen; `GET /api/cards/[id]` response contains only `last4` |
| Server rejects bad merchant, zero/negative limit, limit > 5 000 000, bad currency | `curl` POST with each invalid body → `400`; TypeScript confirms the route handler checks each |

## Risks

- **One-time reveal is front-end state only.** If the user closes the drawer before copying the number, it is gone. That is the intended behaviour per the ticket, but ops should be warned in the UI (e.g., "Copy now — this is the only time you'll see it.").
- **`globalThis` store pattern must be extended correctly.** Forgetting to add `cards` to both the interface and `createStore` causes a runtime crash on first write.

## Out of scope

- Persistence (NWP-203): cards vanish on server restart by design.
- Editing a card's limit (NWP-202).
- Authentication, roles, real card-network calls.
- Spend tracking against actual payments: the `spendLimit` is stored and displayed, but deducting from it requires a separate ticket linking cards to payments.
