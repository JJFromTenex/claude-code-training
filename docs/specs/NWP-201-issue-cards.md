# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`'s process, then reviewed.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Claude
**Status:** reviewed

## Problem

Ops issues virtual cards today by messaging the platform team, who create them by hand — hours of turnaround, twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see the cards they've issued, and open one to check it, without leaving the console.

## Current state

Nothing card-related exists yet. `build-battle/merchant-console/CLAUDE.md`'s own route table says it plainly: "Cards is NWP-201 and does not exist yet." Confirmed by grep — no `card` in `src/data/types.ts`, no `/cards` route, no card-shaped file anywhere under `src/`.

What already exists that this ticket should reuse rather than reinvent:

- `src/lib/money.ts` — `parseAmountToMinorUnits()` parses a client-typed string (`"5,000.00"`) into integer minor units at the boundary, returning `null` on anything it can't represent exactly. `formatMoney()`/`formatMoneyCompact()` format minor units back out. This is exactly the boundary-parse the ticket's spend limit needs — no second parser.
- `src/data/merchants.ts` — `merchants: Merchant[]`, each with a fixed `currency`. `merchantById(id)`.
- `src/data/store.ts` — the in-memory store, generated once at boot, held on `globalThis` across HMR. `Store` interface currently has `merchants/payments/refunds/disputes/payouts`; `cards` is a new key.
- `src/data/generate.ts` — deterministic seed data (`mulberry32(20260813)`), `GENERATED_AT` as the fixed "now." Every other resource (payments, disputes, payouts) is pre-seeded with realistic history; cards should follow the same pattern rather than launching empty, both for a better first look at `/cards` and so the spend-progress stretch goal has something at 80%+ to actually show.
- `src/components/ui/payments/StatusBadge.tsx` — a generic status→badge mapper already used for `PaymentStatus`/`DisputeStatus`/`PayoutStatus`. Extending its `AnyStatus` union to include `CardStatus` reuses it instead of a second badge component.
- `src/components/Drawer.tsx` — the only dialog-shaped primitive in the app (Radix `Dialog` under the hood). `src/app/payments/export-dialog.tsx`* is the working example of "form/dialog opened from a page button, does a fetch, shows a result" — the issue-card flow is the same shape. (*from the still-open `NWP-101-export-options` PR; not on `main` yet, but it's the pattern to match.)
- `src/app/payments/[id]/page.tsx` — the detail-page shape to match: `notFound()` on a missing id, a `Field`/`Divider` layout, a dotted timeline list. Card detail should look like a sibling of this page, not a new visual language.
- `src/components/ui/navigation/AppSidebar.tsx` and `Breadcrumbs.tsx` — nav is a hand-maintained array/map; `/cards` needs an entry in both or it's unreachable and unlabeled.

Ticket claims that hold up against the code: everything. Nothing in the ticket contradicts what's actually here — this is a genuinely greenfield route inside an established app.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `merchant-console/CLAUDE.md`, `.claude/rules/money.md`, ticket rule 1 | A `$250.00` limit stored as `250.00` drifts the moment it's compared or summed |
| Never persist or display a full card number after creation; the reveal is a one-time response | Ticket rule 2, `.claude/rules/cards.md` | A "masked" list that secretly round-trips the full number through client state or a re-readable field is worse than not masking at all |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal, guarded server-side | Ticket rule 3, `.claude/rules/cards.md` | A client that just PATCHes any status string can revive a cancelled card |
| The `4242` BIN is not optional; every generated number carries a valid Luhn digit | Ticket rule 4, `.claude/rules/cards.md` | A "card number" that fails Luhn isn't a fake card, it's a bug that looks like one |
| Validate on the server: missing merchant, limit ≤ 0, limit > 5,000,000 minor units, currency outside USD/EUR/GBP | Ticket "Server-side validation" | Client-only checks are convenience, not enforcement — a direct POST bypasses them |
| One query/data-access implementation per resource | `merchant-console/CLAUDE.md` #3, generalized | A second way to list/mutate cards drifts from the first the moment either changes |

## Approach

Add a `Card` resource that mirrors how `Dispute`/`Payout` are already built: a type in `types.ts`, a slice of the in-memory store seeded in `generate.ts`, a data-access module (`src/data/cards.ts`) that is the *only* place cards are read or mutated, and pure helpers (`src/lib/cards.ts`) for the two pieces of logic that are genuinely stateless and testable in isolation — Luhn/number generation and the status-transition rule. Two route handlers (`/api/cards`, `/api/cards/[id]`) do validation and call into `cards.ts`; three pages (`/cards` list, `/cards/[id]` detail, plus the issue-drawer and status-action client components) render it. `StatusBadge` gets extended rather than duplicated.

The one place the ticket is silent and the codebase already has an opinion: currency. The form asks for "a currency," but every `Merchant` already carries its own fixed `currency`, and a card denominated in a currency the merchant doesn't settle in isn't a real product decision, it's a data-entry mistake waiting to happen. The issue form derives currency from the chosen merchant (shown, not freely editable) rather than offering an independent picker, and the server rejects a mismatch if one somehow arrives anyway.

**Considered and rejected:** letting ops pick currency freely and only checking it's in `{USD, EUR, GBP}`, as the ticket's literal wording suggests. Rejected because it would let a USD card exist against a EUR merchant, which the merchant model itself already forbids implicitly — enforcing it explicitly is a one-line check that prevents a real support ticket later ("why doesn't this merchant's card total match their settlement currency"), which is exactly the category of thing the ticket says to look for: "the things an ops tool actually needs once real people click it twice... it does not say what those are."

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `CardCategory`, `CardEvent`, `Card` |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store` |
| `src/data/generate.ts` | change | Seed ~6 example cards, varied status/spend/category |
| `src/lib/cards.ts` (+ `.test.ts`) | add | `generateCardNumber`, `luhnCheckDigit`, `isValidLuhn`, `isValidCardTransition` — pure, testable |
| `src/data/cards.ts` (+ `.test.ts`) | add | `listCards`, `cardById`, `issueCard` (validates + mutates), `setCardStatus` (transition-guarded) |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue (returns the number exactly once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, `PATCH` status transition |
| `src/app/cards/page.tsx` | add | List: nickname, merchant, masked number, limit, status, created |
| `src/app/cards/issue-drawer.tsx` | add | Client: issue form → one-time reveal step |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record, spend progress, history |
| `src/app/cards/[id]/status-actions.tsx` | add | Client: freeze/unfreeze, cancel-with-confirm, no full reload |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend `AnyStatus`/`LABELS`/`DOTS`/`VARIANTS` for `CardStatus` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add "Cards" nav entry |
| `src/components/ui/navigation/Breadcrumbs.tsx` | change | Add `cards: "Cards"` label |
| `src/app/siteConfig.ts` | change | Add `baseLinks.cards` |

## Plan

1. **Types, store, seed data** — done when: `npm run build` still type-checks with the new `Card` type wired into `Store`, and `store.cards` has ~6 varied example cards at boot.
2. **`src/lib/cards.ts` + tests** — done when: `luhnCheckDigit`/`generateCardNumber`/`isValidCardTransition` are written and `npm test` passes new tests proving Luhn validity, the `4242` prefix, and every legal/illegal state transition.
3. **`src/data/cards.ts`** — done when: `issueCard()` rejects each of the four named invalid inputs with a specific message, and `setCardStatus()` refuses an illegal transition without touching the record.
4. **API routes** — done when: `curl -X POST /api/cards` with a bad payload returns 400 with a real message for each rule; a good payload returns 201 with `number` present once; a second `GET`/`PATCH` on that same card never returns `number`.
5. **List + detail pages, StatusBadge, nav** — done when: `/cards` and `/cards/[id]` render against the seeded data, reachable from the sidebar, with a card's number showing masked everywhere except the one POST response.
6. **Issue drawer + status actions (client)** — done when: issuing a card from the UI shows the number once, closing and reopening the drawer never shows it again, and freeze/unfreeze/cancel update the detail page without a full page reload.
7. **Stretch: spend progress, category, empty/error states, cancel confirm** — done when: a seeded card at ≥80% spend shows an amber bar, category shows on list and detail, cancel requires a second confirming click, and every validation/not-found path has a specific written message.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | `curl -X POST /api/cards` with a valid payload → 201, card appears in a subsequent `GET /api/cards` |
| Card list | `GET /api/cards` and `/cards` render nickname, merchant, masked number, limit, status, created date |
| Card detail | `/cards/<id>` renders the full record + spend vs. limit for a seeded card |
| Generated numbers | `cards.test.ts` asserts every generated number starts `4242`, is 16 digits, passes `isValidLuhn` |
| Reveal once, mask forever | `POST /api/cards` response body is the only place `number` (not `last4`) ever appears — grep the diff for every response shape to confirm |
| Server-side validation | Four `curl` calls, one per rule (`missing merchant`, `limit=0`, `limit=5000001`, `currency="JPY"`), each returns 400 with a message naming the actual problem |
| Freeze/unfreeze (stretch) | `PATCH /api/cards/<id>` `active→frozen→active` both succeed; UI updates without navigation |
| Spend progress (stretch) | Seeded card at ≥80% renders the amber variant; one below 80% doesn't |
| Category lock (stretch) | Category set at issue time, shown on list + detail, no edit control exists anywhere |
| Tests (stretch) | `npm test` passes, including new Luhn + transition tests |
| Empty/error states (stretch) | Zero-card state has real copy (not attempted here since seed data guarantees ≥1 card, but the list still renders a written empty state defensively); every validation failure has a specific message, not a generic "invalid" |

## Risks

- **Seeding non-zero `spent` on cards nobody actually charged** invents data the ticket doesn't ask for. Mitigated by keeping it small (a handful of cards) and honest — every real card issued through the UI starts at `spent: 0`, and only the pre-existing seed history carries a nonzero figure, exactly like every other seeded resource in this app already does.
- **`Drawer` reused for a yes/no confirm** (cancel) is heavier than the action needs, but it's the only dialog-shaped primitive in the codebase — building a second, lighter one duplicates a primitive for one call site.

## Out of scope

- Persistence of any kind — cards live in the in-memory store and vanish on restart, same as everything else. NWP-203.
- Auth, roles, permissions.
- Real card-network calls.
- Editing a card's limit after issue — NWP-202.
- Tier-2 items beyond currency-matching and idempotent submit (an audit trail beyond a simple status-history list, real double-submit protection via an idempotency key) — the codebase has no existing pattern for either, and inventing one is a bigger decision than this ticket's 45-minute frame implies. A lightweight version of both is included (status history list; disable-on-submit) without over-building.

## Open questions

- Whether "spend against the limit" should ever be adjustable after issue (e.g., a way to simulate a purchase). The ticket doesn't ask for it and there's no transaction feed to drive it honestly, so this spec treats `spent` as seed-only history plus `0` for anything issued live in this session.
