# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code, with `/spec`. Load it when you build: `@docs/specs/NWP-201-issue-cards.md`
> **Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Saurabh Suri · **Status:** done

## Problem

Ops asks the platform team for a virtual card over Slack; it takes hours, happens 12–20 times a week, and two cards went out last month with the wrong limit. Ops needs to issue, list, and inspect cards in the console.

## Current state (paths under `build-battle/merchant-console/`)

- `src/data/types.ts` has `Currency = "USD" | "EUR" | "GBP"` and no card type. `src/data/store.ts` is an in-memory store on `globalThis`, filled by `src/data/generate.ts` (a deterministic generator, not JSON as the ticket says).
- `src/data/queries.ts` `parseFilters` is the allowlist-at-the-boundary pattern; `src/app/api/payments/export/route.ts` the `{ error }` 400 shape.
- `src/lib/money.ts` has `formatMoney` and `parseAmountToMinorUnits`; `src/lib/dates.ts` has `formatDate` (UTC tables) and `formatInZone` (detail pages). Both tested beside the code.
- `src/app/payments/page.tsx`, `[id]/page.tsx`, `export-dialog.tsx` are the table, detail, and Radix `Drawer` patterns to mirror. `StatusBadge` holds every status enum. `AppSidebar`, `Breadcrumbs`, `siteConfig` are static nav lists.

## Domain rules

| Rule | Source | If ignored |
| --- | --- | --- |
| Money is integer minor units; `$250.00` is `25000` | `build-battle/merchant-console/CLAUDE.md` §1, `build-battle/merchant-console/.claude/rules/money.md` | the wrong-limit bug this ticket exists for |
| `4242` BIN + valid Luhn, generated server-side | `build-battle/merchant-console/.claude/rules/cards.md` | something resembling a real PAN |
| Full number returned once; records hold last4 + reference | `build-battle/merchant-console/.claude/rules/cards.md`, `build-battle/merchant-console/.claude/rules/api-routes.md` | numbers leak through list/detail |
| `active ⇄ frozen`, either → `cancelled` (terminal); guard on the server | `build-battle/merchant-console/.claude/rules/cards.md` | a cancelled card comes back |
| Every client field allowlisted on the server | `build-battle/merchant-console/.claude/rules/api-routes.md` | `currency: "XYZ"` reaches the store |
| Existing components, labelled inputs, no DB/ORM | `build-battle/merchant-console/.claude/rules/components.md`, the ticket | second dialog impl; wasted clock |

## Approach

`Card` joins the store. Number generation (Luhn, 4242 BIN) is server-only in `src/data/card-number.ts`; client-safe rules (mask, categories, transitions) in `src/lib/cards.ts`; validation and writes in `src/data/cards.ts`, like `queries.ts`. Routes: `GET/POST /api/cards`, `GET/PATCH /api/cards/[id]`; the POST response is the only place the full number exists. UI: `/cards` list, one Drawer dialog with a reveal-once success screen, `/cards/[id]` with a spend bar and history; freeze/unfreeze/cancel via PATCH + `router.refresh()`.

The limit travels as integer minor units; the dialog converts typed input with `parseAmountToMinorUnits`, the server enforces integer, `> 0`, `≤ 5,000,000`, currency allowlist, and currency = merchant's settlement currency.

**Rejected:** storing the PAN and masking at render (breaks reveal-once); accepting `"250.00"` strings on the API (two shapes for one field); a new badge component; seeded cards (a made-up `spent` is not honest, and nothing should hold a card ops did not issue).

## Plan

1. Types + `card-number.ts` + `lib/cards.ts` + tests — done when `npm test` covers Luhn/BIN/mask/transitions.
2. `data/cards.ts` + store — done when the four ticket rejections have tests.
3. Routes — done when curl shows 201 with `number`, 400 per bad body, no `number` in any GET, 409 on cancelled→anything.
4. List + dialog — done when a card issued in the browser shows its number once and is masked in the list.
5. Detail + bar + actions — done when Freeze flips the badge without a reload and a card past 80% is amber.
6. `/ship-ready`, org-standards audit, PR.

## Verification

Curl transcripts per route; `card-number.test.ts` for Luhn; grep of GET bodies for `"number"`; browser click-through; network tab for PATCH + RSC refresh with no document load; `npm test` summary; empty-table copy and dialog error banner.

## Out of scope

Persistence (NWP-203), limit editing (NWP-202), auth, issuer calls, recording spend against a card (`spent` stays `0` until that exists).
