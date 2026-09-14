# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code, with `/spec`. Load it when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Saurabh Suri · **Status:** done

## Problem

Ops asks the platform team for a virtual card over Slack; it takes hours, happens 12–20 times a week, and two cards went out last month with the wrong limit. Ops needs to issue, list, and inspect cards in the console.

## Current state (paths under `build-battle/merchant-console/`)

- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"`; no card type. `src/data/store.ts` — in-memory store on `globalThis`, filled by `src/data/generate.ts` (deterministic seed, not JSON as the ticket says).
- `src/data/queries.ts` `parseFilters` — the allowlist-at-the-boundary pattern. `src/app/api/payments/export/route.ts` — the `{ error }` 400 shape.
- `src/lib/money.ts` — `formatMoney`, `parseAmountToMinorUnits`; `src/lib/dates.ts` — `formatDate` (UTC tables), `formatInZone` (detail pages).
- `src/app/payments/page.tsx`, `[id]/page.tsx`, `export-dialog.tsx` — the table, detail, and Radix `Drawer` dialog patterns to mirror. `StatusBadge` holds every status enum. `AppSidebar`, `Breadcrumbs`, `siteConfig` — static nav.

## Domain rules

| Rule | Source | If ignored |
| --- | --- | --- |
| Money is integer minor units; `$250.00` is `25000` | `merchant-console/CLAUDE.md` §1, `.claude/rules/money.md` | the wrong-limit bug this ticket exists for |
| `4242` BIN + valid Luhn, generated server-side | `.claude/rules/cards.md` | something resembling a real PAN |
| Full number returned once, in the creation response; records hold last4 + reference | `.claude/rules/cards.md`, `api-routes.md` | numbers leak through list/detail |
| `active ⇄ frozen`, either → `cancelled`, terminal; guard on the server | `.claude/rules/cards.md` | a cancelled card comes back |
| Validate every client field against an allowlist on the server | `.claude/rules/api-routes.md` | `currency: "XYZ"` reaches the store |
| Use existing components; labelled inputs; no DB/ORM | `.claude/rules/components.md`, ticket | second dialog impl; wasted clock |

## Approach

Add `Card` to the store; a pure `src/lib/cards.ts` (Luhn, generator, mask, transitions) with tests beside it like `money.ts`; validation + writes in `src/data/cards.ts` like `queries.ts`; `GET/POST /api/cards`, `GET/PATCH /api/cards/[id]`. The POST response is the only place the full number exists. `/cards` list + one Drawer dialog with a reveal-once success screen; `/cards/[id]` with a spend bar; freeze/unfreeze/cancel via PATCH + `router.refresh()`.

Wire format for the limit is integer minor units. The dialog converts the typed `"250.00"` with `parseAmountToMinorUnits`; the server enforces integer, `> 0`, `≤ 5,000,000`, currency allowlist, and currency = merchant's settlement currency.

**Rejected:** storing the PAN and masking at render (breaks reveal-once); accepting `"250.00"` strings on the API (two shapes for one field); a new badge component (`StatusBadge` already exists); zero seed cards (the amber bar would be unseeable).

## File map

`types.ts`, `store.ts`, `generate.ts` (change) · `lib/cards.ts` + test, `data/cards.ts` + test (add) · `api/cards/route.ts`, `api/cards/[id]/route.ts` (add) · `app/cards/page.tsx`, `[id]/page.tsx`, `issue-card-dialog.tsx`, `card-actions.tsx`, `spend-progress.tsx` (add) · `StatusBadge`, `AppSidebar`, `Breadcrumbs`, `siteConfig` (change).

## Plan

1. Types + `lib/cards.ts` + tests — done when `npm test` covers Luhn/BIN/mask/transitions.
2. `data/cards.ts` + store + seed — done when the four ticket rejections have tests.
3. Routes — done when curl shows 201 with `number`, 400 for each bad body, no `number` in GET, 409 on cancelled→anything.
4. List + dialog — done when a card issued in the browser shows its number once and appears masked in the list.
5. Detail + bar + actions — done when a seeded card past 80% is amber and Freeze flips the badge without a reload.
6. `/ship-ready`, org-standards, PR.

## Verification

Core criteria: curl transcripts for POST/GET/PATCH; `cards.test.ts` for Luhn; grep of GET bodies for `"number"`; browser click-through. Stretch: network tab shows PATCH + RSC refresh, no document load; amber class on `card_0001`; category on list/detail; `npm test` summary; empty-table copy and dialog error banner.

## Risks / out of scope

Store shape changes need one dev-server restart. `spent` is a seeded counter; recording spend is not this ticket. Persistence (NWP-203), limit editing (NWP-202), auth, issuer calls: out.
