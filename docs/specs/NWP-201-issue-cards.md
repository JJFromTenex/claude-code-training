# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** ark9324@stern.nyu.edu
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — hours per card, 12–20 times a week, and two cards last month got the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see the cards they have issued, and open one to check it, from the console.

## Current state

Nothing card-related exists; this is greenfield against existing infrastructure.

- `src/data/store.ts` — in-memory store on `globalThis`; has no `cards` slice
- `src/data/generate.ts` — deterministic PRNG seed data (note: `CLAUDE.md` says "seed JSON", but data is generated procedurally here)
- `src/lib/money.ts` — `formatMoney` and `parseAmountToMinorUnits`, the boundary converter for the limit field
- `src/components/Drawer.tsx` — Radix dialog wrapper (accessible name, focus trap, Escape); there is **no** `Dialog.tsx` despite `.claude/rules/components.md` claiming one
- `src/components/ui/payments/StatusBadge.tsx` — three exhaustive `Record`s over payment/dispute/payout statuses; adding a card status breaks the build until all three are extended
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx` — the list and detail conventions to copy
- No POST route exists anywhere, so this ticket establishes the error shape: `{ error: string }` with an honest status code
- Navigation is three touches: `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`, `src/components/ui/navigation/Breadcrumbs.tsx`

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md`, `.claude/rules/money.md` | Cents drift; limits stored as floats |
| Full number returned exactly once, at creation; store last4 + reference only | `.claude/rules/cards.md` | A PAN becomes re-readable from the store or client state |
| Status machine `active ⇄ frozen`, either → `cancelled` (terminal), guarded on the server | `.claude/rules/cards.md` | A cancelled card comes back to life via a crafted PATCH |
| `4242` test BIN + valid Luhn on every generated number, server-side | `.claude/rules/cards.md` | Something resembles a real PAN, or numbers are minted in the browser |
| Allowlist-validate all client input on the server | `.claude/rules/api-routes.md` | Bad merchant/currency/limit reaches the store |

## Approach

One domain lib (`src/lib/cards.ts`: Luhn, number generation on the 4242 BIN, mask, transition table), a `Card` type and store slice with five deterministically seeded cards, store accessors in `src/data/cards.ts`, a POST create route and a PATCH transition route, and three server-rendered surfaces: `/cards` list, `/cards/[id]` detail, and a Drawer-based issue form whose success phase reveals the number once and clears it on close. Pages read the store directly like the payments pages do, so no GET route is needed.

**Considered and rejected:** starting with an empty card list — "spend against the limit" is a core criterion and a fresh card always has spend 0, so seeding is what makes the detail page and the amber bar demonstrable. Also rejected: a card-specific badge component (the shared `StatusBadge` is exhaustively typed, so extending it is nine lines and `tsc` proves completeness).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/cards.ts` (+ `.test.ts`) | Add | Luhn, generator, mask, state machine — everything downstream imports it |
| `src/data/types.ts` | Change | `CardStatus`, `Card` |
| `src/data/generate.ts`, `src/data/store.ts` | Change | Seed 5 cards; add `cards` slice |
| `src/data/cards.ts` | Add | `listCards`, `cardById`, `issueCard`, `transitionCard` |
| `src/app/api/cards/route.ts` | Add | POST: validation + one-time reveal |
| `src/app/api/cards/[id]/route.ts` | Add | PATCH: server-guarded transitions |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Extend the status union and all three records at once |
| `siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | Change | The three navigation touches |
| `src/app/cards/page.tsx`, `[id]/page.tsx`, `issue-card.tsx`, `card-actions.tsx` | Add | List, detail, issue drawer, freeze/unfreeze |

## Plan

1. **Domain lib + types + seed + accessors** — done when: `tsc` clean, seeded cards visible in the store
2. **API routes** — done when: every invalid POST curls to a 400 `{ error }`, a valid one to 201 with a Luhn-valid `4242…` number, and cancel-then-freeze curls to 409
3. **Badge + navigation + list + detail** — done when: `/cards` renders seeded cards masked, detail shows spend against limit
4. **Issue drawer** — done when: issuing shows the number once, closing clears it, list shows the new masked row
5. **Stretch: tests, freeze/unfreeze without reload, spend bar, category lock, history timeline** — done when: `npm test` green and the list toggles without a page load

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card and it appears in the list | Browser: submit the drawer, see the masked row |
| Card list at `/cards` | Browser: seeded cards with nickname, merchant, mask, limit, status, date |
| Card detail with spend vs limit | Browser: open a seeded card |
| 4242 BIN + valid Luhn, server-side | Unit tests + curl the POST response |
| Reveal once, mask forever | Reopen drawer after issue → fresh form; grep rendered HTML for any 16-digit PAN |
| Server-side validation | curl each rejection case → 400 |
| State machine guarded on server | curl cancel → freeze → 409 |

## Risks

- Extending `StatusBadge`'s union breaks the build until all three records are updated — do it in one edit
- Tailwind cannot JIT runtime widths and inline `style` is banned — the spend bar uses a static width-class lookup

## Out of scope

- Persistence (NWP-203), auth/roles, real network calls, limit editing (NWP-202)
- The planted defects in `src/data/metrics.ts` (local-time bucketing) and `src/data/queries.ts` (lexicographic amount sort) — different tickets

## Open questions

- None blocking. Category lock uses a small fixed list; a real MCC table is platform-team territory.
