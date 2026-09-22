# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Load it as context when you build:
> `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Jaiden Lawlor
**Status:** draft

## Problem

Marcus's ops team issues virtual cards by messaging the platform team, who create them by
hand — twelve to twenty times a week, hours each, and last month two went out with the wrong
spend limit because the request lived in a Slack thread. They need to issue a card, see the
cards they issued, and open one to check it, inside the console, today.

## Current state

Card issuing is **greenfield** — nothing exists yet, so the risk is missing a convention, not
reimplementing a helper.

- `src/data/types.ts` — has `Payment`, `Merchant`, `Currency`; **no `Card` type**. The only
  `last4` here is on `Payment`.
- `src/data/store.ts` — in-memory store on `globalThis.__northwindStore`, seeded at boot. **No
  `cards` slice.** New records live until the dev server restarts, by design (persistence is NWP-203).
- `src/data/merchants.ts` — `merchants` list and `merchantById()` for validating the merchant.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` at `money.ts:15` (the **only** place an
  amount becomes a string) **and `parseAmountToMinorUnits(input): number | null` at `money.ts:46`**
  — the existing, tested major→minor boundary converter. Reuse both; do not roll a second parser or
  format upstream.
- `src/lib/dates.ts` — `formatDate()` for the created date.
- `src/app/api/payments/route.ts` + `src/data/queries.ts` — the route-handler pattern to mirror:
  `parseFilters` validates client input **against an allowlist** before it reaches the store, and
  the handler returns `NextResponse.json(...)`. No second query builder.
- `src/components/` — `Button`, `Input`, `Select`, `Badge`, `Table` exist. **There is NO `Dialog`
  component** — only `Drawer.tsx` (a Radix-dialog-backed slide-in). The `.claude/rules` and app
  CLAUDE.md *claim* a Dialog; the file does not exist. Use `Drawer` for the issue form or hand-build
  a modal. `src/components/ui/payments/StatusBadge.tsx` is the badge to mirror for card status.
- `src/app/siteConfig.ts` — `baseLinks` drives the sidebar (`AppSidebar.tsx` reads it); adding `/cards`
  to the nav requires editing **both**.
- `vitest.config.ts` — `include: ["src/**/*.test.ts"]` (**`.ts` only**) + `environment: "node"`. Card
  tests must be pure-logic `.ts`; a `.tsx` component test is silently excluded.
- `src/app/payments/page.tsx` + `filter-bar.tsx` — server-page + `"use client"` form pattern.
- `.claude/rules/cards.md` — the binding card rules (quoted below).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; `$250.00` = `25000`; format once at the edge | `CLAUDE.md`, `.claude/rules/money.md` | Limits drift; a wrong limit is the exact bug this ticket exists to kill |
| Generate the number **server-side**, `4242` BIN + valid Luhn check digit | `.claude/rules/cards.md` | A browser-generated PAN is a bug; an invalid Luhn fails the criterion |
| **Reveal once.** Full number in the creation response only — never on the record, list, or detail payload, never left in client state after the success screen | `.claude/rules/cards.md` | Leaked PAN; core criterion fails |
| Mask everywhere else as `•••• 4242` | `.claude/rules/cards.md` | Core criterion fails |
| Status machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal; **guard on the server** | `.claude/rules/cards.md` | UI-only guards let an illegal transition through |
| Validate on the server: merchant exists, limit integer `0 < n ≤ 5_000_000`, currency ∈ `USD/EUR/GBP` | ticket §Core, `.claude/rules/api-routes.md` | Untrusted client writes bad cards |

## Approach

Add a `Card` model and a `cards` store slice, a pure card library (`src/lib/cards.ts`) holding the
Luhn generator, the masker, and the transition guard, and a validated route pair
(`/api/cards`, `/api/cards/[id]`). The UI is a `/cards` list with an **issue dialog** (client) that
POSTs to `/api/cards`; the POST response carries the full number **once**, rendered on a success
screen in ephemeral client state, then a `/cards/[id]` detail shows the masked record and spend
against the limit. Server first (model → generator → validated route), UI second.

**Considered and rejected:** a dedicated `/cards/new` page that redirects to the detail after
issuing. Rejected because the one-time full number would have to survive a navigation, tempting a
re-readable place to stash it — exactly what "reveal once" forbids. A dialog that shows the reveal
in state it can drop on close keeps the number truly one-time.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `Card`, `CardStatus` (`active`/`frozen`/`cancelled`) |
| `src/data/store.ts` | change | Add `cards: Card[]` slice to the in-memory store |
| `src/lib/cards.ts` | add | Pure: `generateCardNumber()` (4242+Luhn), `luhnCheckDigit()`, `maskCard()`, `canTransition()` |
| `src/lib/cards.test.ts` | add | Tests on the Luhn generator + transitions (cheapest stretch, first tie-break) |
| `src/data/cards.ts` | add | In-memory helpers: `issueCard()`, `listCards()`, `cardById()`, `setCardStatus()` (mirrors `queries.ts`) |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue — server validation, returns full number once |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail (masked); `PATCH` status with server-side transition guard (stretch: freeze/unfreeze) |
| `src/app/cards/page.tsx` | add | `/cards` list: nickname, merchant, masked number, limit, status, created |
| `src/app/cards/issue-dialog.tsx` | add | `"use client"` issue form (built on `Drawer`, not a non-existent `Dialog`) + one-time reveal success screen |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record + spend against limit (stretch: amber >80% bar) |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Mirror `payments/StatusBadge.tsx` |
| `src/app/siteConfig.ts` **+** `src/components/ui/navigation/AppSidebar.tsx` | change | Add the `/cards` nav entry — the sidebar reads `siteConfig.baseLinks`, so **both** change |

## Plan

Sequenced so each step ends somewhere verifiable.

1. **Model + store slice** — `Card`/`CardStatus` in types, `cards: []` in the store. *Done when:* it typechecks and the store boots.
2. **Pure card lib + tests** — Luhn generator on `4242`, masker, `canTransition`. *Done when:* `npm test` passes and generated numbers validate Luhn.
3. **`issueCard` + validated `POST /api/cards`** — server validation (merchant, limit range, currency); response returns the card **and the full number once**; record stores `last4` + reference only. *Done when:* `curl` issues a card and rejects a bad limit/currency with a 400.
4. **`GET /api/cards` + `/cards` list page** — masked rows. *Done when:* an issued card shows in the list as `•••• 4242`.
5. **Detail page + `GET /api/cards/[id]`** — full masked record, spend vs limit. *Done when:* opening a card renders its record; no full PAN in the payload.
6. **Issue dialog + one-time reveal** — form posts, success screen shows the number once, closing drops it. *Done when:* issuing shows the number, reopening the card never does.
7. **Read the diff** against the rules (minor units, server validation, no second builder), then stretch: `PATCH` freeze/unfreeze + progress bar.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card; it appears in the list | Submit dialog → new masked row in `/cards` |
| `/cards` list with the six columns | Visual + the row renders nickname/merchant/`•••• 4242`/limit/status/date |
| Card detail shows record + spend vs limit | Open `/cards/[id]`; spend/limit rendered |
| Numbers server-side, `4242` BIN, valid Luhn | `cards.test.ts` asserts prefix `4242` and Luhn-valid; generation lives in the route/lib, not the browser |
| Reveal once, mask forever | POST response includes full number; `GET` list/detail payloads contain only `last4`; success-screen state cleared on close |
| Server-side validation | `curl` with missing merchant / `0` / `-1` / `5_000_001` / `JPY` each returns 400 with a message |

## Risks

- **Float drift on the limit.** The dialog collects a major-unit amount; the **server** converts once
  via the existing **`parseAmountToMinorUnits()` (`money.ts:46`)** — which returns `null` on bad input,
  giving the validation path for free — and everything after is integer. Do not hand-roll a parser.
- **Masking the literal `4242`.** The rule's example `•••• 4242` looks like the BIN, but the four shown
  digits are the card's **actual generated `last4`**, not a hardcoded `4242`. Mask with `card.last4`.
- **Reveal-once leak.** Assert no `GET` path ever includes the full PAN, and clear the success-screen
  state on close. This is the easiest core criterion to fail silently.
- **UI-only transition guard.** Enforce `canTransition()` in the `PATCH` handler, not just the button.
- **Clock.** 45 minutes: land the six core criteria and the Luhn test before any other stretch.

## Out of scope

- Persistence — in-memory store only; cards vanish on restart (NWP-203).
- Auth / roles, real card-network calls, editing a limit after issue (NWP-202).

## Open questions

- **Spend source.** No card transactions exist. Plan: `Card.spend` starts at `0` (minor units, card's
  currency); detail shows `spend / limit`. Seed a little mock spend so the amber->80% bar is demoable?
- **Merchant category lock (stretch).** `Merchant` has no category field today — introduce a small enum
  chosen at issue time, or defer? Lower priority than the Luhn test.
