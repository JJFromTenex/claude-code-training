# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** JJ Englert
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue, list, and inspect cards from the console itself, with the limit enforced from the moment the card exists.

## Current state

- `build-battle/merchant-console/src/data/store.ts` — in-memory store on `globalThis` holding `merchants`, `payments`, `refunds`, `disputes`, `payouts`. **No `cards` collection exists.** The store is the only place state lives; there is no database by design (NWP-203).
- `build-battle/merchant-console/src/data/types.ts` — domain types. **No `Card` type.** `Currency` is already `"USD" | "EUR" | "GBP"`, which is exactly the allowlist the ticket asks for.
- `build-battle/merchant-console/src/lib/money.ts` — `formatMoney(minorUnits, currency)` and `parseAmountToMinorUnits(input)`. Both already exist; the card feature must not reimplement them.
- `build-battle/merchant-console/src/app/api/payments/route.ts` — the route-handler pattern: `NextRequest` in, `NextResponse.json` out. No POST handler exists anywhere yet; this will be the first write endpoint.
- `build-battle/merchant-console/src/app/payments/page.tsx` — server-component list page using `TableRoot/Table/...` from `@/components/Table` and `StatusBadge`. The cards list mirrors this.
- `build-battle/merchant-console/src/components/ui/navigation/AppSidebar.tsx` + `src/app/siteConfig.ts` — nav items come from `siteConfig.baseLinks`. **No `cards` link exists.** `/cards` currently 404s.
- `build-battle/merchant-console/.claude/rules/cards.md` — already written, scoped to `src/**/card*` and `src/**/cards/**`. It states the Luhn/4242, reveal-once, and state-machine rules. Loads automatically once card files exist.
- `build-battle/merchant-console/src/components/ui/payments/StatusBadge.tsx` — typed against payment/dispute/payout statuses only. Card statuses need their own small badge rather than widening this union.
- `build-battle/merchant-console/vitest.config.ts` + `src/lib/*.test.ts` — vitest is set up, node environment. New tests go beside the code they cover.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; format once at the edge | `merchant-console/CLAUDE.md` §1, `rules/money.md` | A `$250.00` limit stored as `250` or `"$250"` breaks every comparison and the spend bar |
| Every generated number starts `4242` and passes Luhn | `rules/cards.md`, ticket rule 4 | Anything else could resemble a real PAN in a public repo |
| Generate on the server, never in the browser | `rules/cards.md` | A client-generated number is forgeable and untestable |
| Reveal once: full number only in the creation response | `rules/cards.md`, ticket rule 2 | Storing or re-serving it turns a one-time reveal into a data-exposure bug |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal; guard on the server | `rules/cards.md`, ticket rule 3 | A UI-only guard lets a `PATCH` resurrect a cancelled card |
| Validate on the server against allowlists; client checks are convenience only | `rules/api-routes.md`, ticket core criterion 6 | Bad limits and currencies reach the store |
| No database, ORM, or migration | ticket "Out of scope", `CLAUDE.md` | Costs the clock, earns zero, and is a quality failure on the rubric |

## Approach

Add `Card` to the domain, a `cards` array on the in-memory store, and a small `src/lib/cards.ts` that owns the three things the rules are about: Luhn generation on the `4242` BIN, masking, and the status transition table. Route handlers under `src/app/api/cards/` do all validation and are the only place the full PAN is ever returned (POST response only). The store keeps `last4` and a reference id, never the PAN. Pages under `src/app/cards/` mirror the payments page pattern: a server-rendered list, a server-rendered detail, and one small client component for the issue form and the freeze toggle so the list updates without a reload.

**Considered and rejected:** putting the card number on the `Card` record and "just not rendering it." That makes reveal-once a UI promise instead of a data property, and the list/detail JSON would leak it to anyone who opened DevTools. Rejected in favour of returning the PAN from POST only and storing `last4` + a `numberRef`.

Also rejected: widening `StatusBadge`'s union to include card statuses. It would touch three `Record<AnyStatus, …>` maps for a feature that needs three labels; a six-line `CardStatusBadge` is cheaper and keeps the payments component honest.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `IssueCardInput` types |
| `src/data/store.ts` | change | `cards: Card[]` on the store, empty at boot |
| `src/lib/cards.ts` | add | Luhn check digit, `generateCardNumber()` on `4242`, `maskNumber()`, `CARD_TRANSITIONS`, `canTransition()`, `validateIssueInput()` |
| `src/lib/cards.test.ts` | add | Luhn validity, BIN prefix, mask shape, transition table incl. cancelled-is-terminal, validation rejects |
| `src/data/cards.ts` | add | `issueCard()`, `listCards()`, `getCard()`, `transitionCard()` against the store; returns public records (no PAN) except the one-time issue result |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue (validates, returns PAN once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail (masked), `PATCH` status with transition guard |
| `src/app/cards/page.tsx` | add | list page: table of cards, empty state, issue button |
| `src/app/cards/[id]/page.tsx` | add | detail page with spend bar |
| `src/app/cards/issue-card-dialog.tsx` | add | client: form → POST → success screen showing PAN once |
| `src/app/cards/freeze-toggle.tsx` | add | client: PATCH freeze/unfreeze, `router.refresh()` |
| `src/app/cards/card-status-badge.tsx` | add | three-state badge |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | change | Cards nav entry + breadcrumb label |
| `.claude/rules/cards.md` | none | already correct; it starts loading once these files exist |

## Plan

1. **Types + store** — done when: `Card` compiles and `store.cards` is `[]` at boot.
2. **`src/lib/cards.ts` + tests** — done when: `npm test` passes with new cases for Luhn, BIN, mask, transitions, validation.
3. **API routes** — done when: `curl -X POST /api/cards` with a bad currency returns 400; a good body returns 201 with `number`; `GET /api/cards` never contains `number`.
4. **List + detail pages** — done when: `/cards` renders the empty state, then a row after issue; `/cards/<id>` shows the spend bar.
5. **Issue dialog + freeze toggle** — done when: issuing shows the PAN once and the list updates; freeze flips status without reload.
6. **Nav + breadcrumbs** — done when: Cards appears in the sidebar and the breadcrumb reads "Cards".
7. **`/ship-ready`, then PR via `/pr`.**

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Dialog submit → row appears; `POST /api/cards` 201 |
| Card list | `/cards` shows nickname, merchant, `•••• 4242`, limit, status, created |
| Card detail | `/cards/<id>` shows full public record and spend vs limit |
| Generated numbers | `cards.test.ts`: every generated number starts `4242`, passes Luhn, 16 digits |
| Reveal once | PAN present in POST body; absent from `GET /api/cards` and `GET /api/cards/<id>`; test asserts public record has no `number` key |
| Server-side validation | 400 on missing merchant, limit ≤ 0, limit > 5,000,000, currency not in allowlist; tested in `validateIssueInput` |
| Stretch: freeze/unfreeze | toggle on list, `router.refresh()`, no full reload |
| Stretch: spend bar | detail page bar, amber ≥ 80% |
| Stretch: category lock | `category` on issue, shown on card |
| Stretch: tests | `npm test` green, Luhn + transitions covered |
| Stretch: empty/error states | written empty state on `/cards`; form errors from the server message |

## Risks

- **Spend** is not in the data model; there are no card transactions. I will seed `spent` as a small deterministic fraction of the limit at issue time so the bar is real without inventing a transactions table. Called out in the PR.
- `NextResponse.json` on a POST must use status 201, not the default 200, or the "created" semantics are lost.

## Out of scope

- Persistence (NWP-203). Cards vanish on dev-server restart, by design.
- Editing a limit after issue (NWP-202).
- Auth, roles, real issuer calls.
