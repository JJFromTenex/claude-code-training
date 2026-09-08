# SPEC · NWP-201 — Issue virtual cards from the console

**Ticket:** [NWP-201](../tickets/NWP-201.md) · **Author:** Yusif · **Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — twelve to twenty times a week, hours each time. Last month two were created with the wrong limit because the request lived in a Slack thread. Ops needs to issue a card, list what they issued, and open one, without leaving the console.

## Current state

- `src/app/` — overview, payments, disputes, payouts. No `/cards`; `merchant-console/CLAUDE.md` says "Cards is NWP-201 and does not exist yet".
- `src/data/store.ts` — in-memory store on `globalThis.__northwindStore`, seeded by `generate.ts`. Merchants, payments, refunds, disputes, payouts — no `cards`.
- `src/data/types.ts` — `Currency`, `Merchant` (currency + IANA `timezone`), `Payment`. No card types.
- `src/lib/money.ts` — has `formatMoney`, `sumMinorUnits`, `parseAmountToMinorUnits`; the limit parser exists, so writing a second is the defect convention 3 warns about.
- `src/lib/dates.ts` — `formatDate` (UTC) and `formatInZone` (merchant tz), reused as-is.
- `src/components/` — Drawer, Button, Input, Select, Badge, Table. No `Dialog`, so the ticket's "form or dialog" becomes `Drawer`, which had no consumer before this.
- Patterns copied: `src/app/payments/filter-bar.tsx` (controlled client inputs), `src/app/payments/[id]/page.tsx` (detail), `src/components/ui/payments/StatusBadge.tsx` (badge), `src/app/api/payments/route.ts` (parse → allowlist → `NextResponse.json`).
- `src/components/ui/navigation/AppSidebar.tsx` + `src/app/siteConfig.ts` — the nav; Cards goes in both.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Integer minor units; `$250.00` is `25000` | `merchant-console/CLAUDE.md` | Cents drift, limits stored as floats |
| `4242` BIN + valid Luhn, generated server-side | `.claude/rules/cards.md` | Data resembles a real PAN |
| Full number in the creation response only | `.claude/rules/cards.md` | A PAN leaks via list or detail |
| `active ⇄ frozen`, either to `cancelled`, terminal | `.claude/rules/cards.md` | A cancelled card comes back |
| Allowlist client input: merchant, 0 < limit ≤ 5,000,000, USD/EUR/GBP | ticket + `.claude/rules/api-routes.md` | The wrong-limit incidents recur |

## Approach

Add `cards` and an append-only `cardEvents` log to the in-memory store; a pure `src/lib/cards.ts` (Luhn on the 4242 BIN, masking, the status machine, the category allowlist) with tests beside it; route handlers under `src/app/api/cards/` that validate server-side; and the UI in house style — a Cards nav entry, `/cards` with an issue drawer and row-level freeze/unfreeze/cancel, `/cards/[id]` with spend-against-limit and the audit trail. The full number exists only in the 201 and in the drawer's success state, cleared on close.

**Rejected:** a modal `Dialog` (none exists here) and `PATCH /api/cards/[id]` for status (a `/status` action route keeps the guard in one place). Cards are not seeded: the list opens on its written empty state, and spend can only come from captured payments that nothing in scope creates, so `spent` starts and stays 0 rather than reading as invented spend. The bar and its amber threshold are read from the record, on any card.

## File map

Every file this PR touches, minus this spec.

| File | Why |
| --- | --- |
| `src/data/types.ts` | `Card`, `CardStatus`, `CardEvent`, `CardCategory` |
| `src/data/store.ts` | `cards`, `cardEvents`, `cardIdempotency`, hot-reload backfill |
| `src/data/cards.ts` | List, byId, events, idempotent create, transition |
| `src/lib/cards.ts` | Luhn, `maskCard`, `canTransition`, category allowlist |
| `src/lib/cards.test.ts` | Luhn generator + the full state-machine matrix |
| `src/app/api/cards/route.ts` | `GET` list; `POST` create — allowlist, 201, 409 on key reuse |
| `src/app/api/cards/[id]/status/route.ts` | `POST` freeze/unfreeze/cancel, guarded server-side |
| `src/app/cards/page.tsx` | List columns, written empty state, issue trigger |
| `src/app/cards/issue-drawer.tsx` | Issue form + reveal-once success screen |
| `src/app/cards/row-actions.tsx` | Freeze/unfreeze/cancel in place |
| `src/app/cards/cancel-confirm.ts` | Pure arm/disarm rules for the two-click cancel |
| `src/app/cards/cancel-confirm.test.ts` | Blur in/out, null related target, Escape, timeout, success |
| `src/app/cards/[id]/page.tsx` | Record, spend bar (amber past 80%), UTC + merchant tz, trail |
| `src/components/ui/cards/CardStatusBadge.tsx` | Badge in the house `StatusBadge` style |
| `src/app/siteConfig.ts` | `cards` base link |
| `src/components/ui/navigation/AppSidebar.tsx` | Cards nav item |
| `src/components/ui/navigation/Breadcrumbs.tsx` | `cards` path label |
| `merchant-console/CLAUDE.md` | Layout table no longer says cards does not exist |

## Plan

1. Types, store, `src/lib/cards.ts` + tests — done when `npm test` is green.
2. API routes — done when `curl` answers every bad input 400 and an illegal transition 409.
3. UI: nav, list, drawer, detail — done when an issued card lands in the list, its number shows once, and freeze/unfreeze updates the row without a reload.
4. Gates — done when `npm test`, `npm run lint`, `npm run build` all exit 0.

## Verification

| Criterion | Proof |
| --- | --- |
| Issue a card | Drawer submit; `curl -X POST` returns 201 with the record |
| List | `/cards`: nickname, merchant, masked number, lock, limit, status, created |
| Detail | `/cards/<id>`: record, `role="progressbar"` bar, audit trail |
| Generated numbers | `cards.test.ts`: `4242`, 16 digits, Luhn-valid, unique in a batch |
| Reveal once | Number in the 201 only; list JSON, list and detail HTML grepped, zero hits |
| Server validation | `curl`: no merchant, 0, -1, 5,000,001, float, `JPY`, wrong currency — each 400 |
| State machine | `cards.test.ts` matrix + `curl`: `cancelled → active` is 409 |
| Idempotency | Same key + body replays 200 with no number; different body is 409 |

## Risks

- A dev server started before NWP-201 has no card collections — `store.ts` backfills, and browser checks follow a restart.
- A replayed create must not re-reveal the number — the replay path returns no `fullNumber`.
- Cross-currency confusion — the server rejects a currency that is not the merchant's, stricter than the ticket and called out in the PR.

## Out of scope

Persistence (NWP-203), editing a limit after issue (NWP-202), auth, roles, real network calls.
