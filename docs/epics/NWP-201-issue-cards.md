# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** dasol
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants the request and the record in the same place: issue a card, see the cards issued, open one to check it.

## Current state

There is no card domain in this codebase. Everything below is what exists to build on.

- `src/data/types.ts` — defines `Merchant`, `Payment`, `Refund`, `Dispute`, `Payout`, `Currency`. **No `Card`.** `Currency` is already `"USD" | "EUR" | "GBP"`, which is exactly the allowlist the ticket asks for.
- `src/data/store.ts` — the in-memory store, pinned to `globalThis.__northwindStore` so dev-server reloads do not hand each request a fresh copy. `createStore()` builds it from `generate()` plus `merchants`. Cards need a new array on the `Store` interface; they are created at runtime, not generated.
- `src/data/queries.ts` — the single payments path (`parseFilters → filterPayments → sortPayments → paginate`). Its lesson for us is the convention, not the code: route handlers never read `store` directly.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)`, `parseAmountToMinorUnits(input)` which converts `"250.00"` to `25000` at the boundary and returns `null` on garbage, and `sumMinorUnits`. A second formatter or parser is a defect.
- `src/lib/dates.ts` — `formatDate` (UTC, for tables), `formatInZone` (merchant timezone, for detail).
- `src/data/generate.ts:58` — `GENERATED_AT` is pinned to `2026-08-13T00:00:00.000Z`. Per `merchant-console/CLAUDE.md`, anything bucketed against the real clock comes back empty. Card `createdAt` is a genuine runtime event, so `new Date()` is correct here — this is the one place the anchor does not apply, and it is worth saying out loud so it does not read as a mistake.
- `src/app/payments/[id]/page.tsx` — the detail-page pattern: async server component, `notFound()` when the record is missing.
- `src/app/payments/page.tsx` and `src/app/payments/export-dialog.tsx` — the list-plus-dialog pattern, including a client component that opens a `Drawer` over a server-rendered table.
- `src/app/siteConfig.ts` — `baseLinks` has overview, payments, disputes, payouts. **No cards.** `src/components/ui/navigation/AppSidebar.tsx:41,47` reads its links from here, so `/cards` is unreachable until both are touched.
- `src/components/` — Drawer, Input, Select, Badge, Table, Button, Divider.

**Where the docs and the code disagree:** `.claude/rules/components.md` says `src/components/` "already has Button, Input, Select, Dialog, Badge". There is no `Dialog.tsx`. `Drawer.tsx` is Radix Dialog underneath and brings the focus trap and Escape handling with it, so the rule's intent holds; the file name in it does not.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units. `$250.00` is `25000` | `.claude/rules/money.md`, ticket rule 1 | Limits drift; a float limit compares wrong forever |
| Every generated number starts `4242` and carries a valid Luhn check digit | `.claude/rules/cards.md`, ticket rule 4 | The repo contains something that resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The PAN exists somewhere it can be read |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload" | `.claude/rules/cards.md`, `.claude/rules/api-routes.md` | A list request leaks every card number |
| Mask everywhere else as `•••• 4242` | `.claude/rules/cards.md` | Inconsistent masking reads as a bug in an audit |
| `active ⇄ frozen`, either to `cancelled`, `cancelled` is terminal. "Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md`, ticket rule 3 | A cancelled card comes back to life via a crafted request |
| Validate client input against an allowlist, reject early, one error shape | `.claude/rules/api-routes.md` | A negative limit or a `JPY` card reaches the store |
| No database, no ORM, no migration | `build-battle/CLAUDE.md`, ticket out-of-scope | Costs points and the clock; persistence is NWP-203 |

## Approach

Add the card domain in the same layered shape the payments domain already has, so nothing about it is novel to a reviewer. `src/lib/cards.ts` owns the pure rules — Luhn generation on the `4242` BIN, masking, and the status-transition guard — and is unit-tested beside itself, because those are the parts that are wrong silently. `src/data/cards.ts` is the only module that touches `store.cards`, exposing list, get, issue, and status-change; route handlers go through it rather than the store, matching the convention `queries.ts` sets. `POST /api/cards` validates merchant, limit, and currency against allowlists, generates the number server-side, stores only `last4` plus a reference, and returns the full number in that one response. The UI is three surfaces: `/cards` listing masked records with an issue Drawer, a success panel that shows the number once and cannot be reopened, and `/cards/[id]` for the full record and spend.

**Considered and rejected:** storing the full number on the card record and masking at render time. It is less code and it is what most consoles do, but `cards.md` forbids the number existing on the record at all — masking at render still means every list payload carries a PAN across the wire. Rejected on the rule.

**Also rejected:** deriving card spend from the merchant's payments in `store.payments`. Those are merchant revenue, not spend on a card issued thirty seconds ago. A new card has spent nothing, so spend is `0` and the detail says so plainly. Inventing a number to make the progress bar look interesting is the dishonest version of this feature.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `Card`, `CardStatus`, and the issue-input shape |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store`, seeded empty |
| `src/lib/cards.ts` | add | Luhn generation on `4242`, masking, transition guard — the pure rules |
| `src/lib/cards.test.ts` | add | Luhn validity, BIN prefix, mask format, every legal and illegal transition |
| `src/data/cards.ts` | add | The only module that reads or writes `store.cards` |
| `src/app/api/cards/route.ts` | add | `POST` issues and reveals once; `GET` lists masked |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` for the guarded status change |
| `src/app/cards/page.tsx` | add | The list, with a written empty state |
| `src/app/cards/issue-dialog.tsx` | add | Client Drawer: form, validation feedback, one-time reveal |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record and spend against limit |
| `src/app/cards/card-actions.tsx` | add | Freeze/unfreeze without a full page reload (stretch) |
| `src/app/siteConfig.ts` | change | Add the `cards` base link |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Surface `/cards` in the sidebar |
| `src/components/ui/navigation/Breadcrumbs.tsx` | change | Label the `cards` segment |

## Plan

1. **Types and store** — add `Card`, `CardStatus`, `cards: []` on the store. Done when: `npx tsc --noEmit` is clean and nothing else changed behaviour.
2. **`src/lib/cards.ts` plus its test** — generator, mask, transition guard. Done when: `npx vitest run src/lib/cards.test.ts` passes, including a case asserting every generated number starts `4242` and passes a Luhn check computed independently in the test.
3. **`src/data/cards.ts`** — list, get, issue, setStatus, all over `store.cards`. Done when: the module compiles and no route yet imports `store` directly.
4. **`POST`/`GET /api/cards`** — allowlist validation, server-side generation, full number in the creation response only. Done when: `curl` issuing a card returns the number once, `GET /api/cards` shows the same card with `last4` and no PAN, and bad limits and currencies come back 400 with a message.
5. **`/cards` list plus issue Drawer** — including the written empty state before any card exists. Done when: issuing from the browser puts a row in the table and shows the number exactly once.
6. **`/cards/[id]` detail** — full record, spend against limit. Done when: clicking a row opens it and `notFound()` answers an unknown id.
7. **`PATCH` plus freeze/unfreeze, then stretch** — guarded server-side. Done when: freezing from the list updates without a page reload and a `PATCH` from `cancelled` is refused with 409.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Fill the Drawer in the browser, submit, watch the row appear in `/cards` |
| Card list | `/cards` shows nickname, merchant, masked number, limit, status, created date |
| Card detail | Click a row; full record and spend render; unknown id gives the 404 page |
| Generated numbers | `src/lib/cards.test.ts` asserts the `4242` prefix and an independently computed Luhn digit over many generated numbers |
| Reveal once, mask forever | `curl -X POST /api/cards` shows the number; `GET /api/cards` and `GET /api/cards/<id>` are grepped for it and it is absent |
| Server-side validation | `curl` with no merchant, limit `0`, limit `-1`, limit `5000001`, currency `JPY` — each returns 400 with a message |
| Status is a state machine | `src/lib/cards.test.ts` covers `active→frozen`, `frozen→active`, both to `cancelled`, and every transition out of `cancelled` being refused; `curl` confirms the route enforces it, not just the button |

## Risks

- **The reveal leaking.** Easiest way to fail the rule is leaving the number in client state after the success panel closes. Mitigation: the panel holds it in local state that is cleared when the Drawer closes, and the list refresh never carries it.
- **Time.** Seven steps is more than 45 minutes if the stretch work starts early. Steps 1–6 are the core criteria; step 7 only begins once they are all verified.
- **`npm run build` is the only thing that type-checks `.tsx`** (`merchant-console/CLAUDE.md`), so `tsc --noEmit` passing is not sufficient before pushing.

## Out of scope

- Persistence of any kind — NWP-203. Cards vanish on dev-server restart, by design.
- Editing a card's limit after issue — NWP-202.
- Authentication, roles, permissions; real card network calls.
- The pre-existing amount-sort defect in `src/data/queries.ts:81` — real, but it belongs to the payments domain and its own ticket.

## Open questions

- **Spend on a new card is `0`.** The ticket asks for "spend against the limit" and lists "honest spend" as a stretch goal, which I read as: do not fabricate it. Flagging in case Ops expected seeded spend to make the bar visible on day one.
- **Merchant currency mismatch.** `merchants.ts` gives every merchant a currency; the ticket lists "currency-matches-merchant" only as a stretch goal, so the core build accepts any of the three and the mismatch check comes later, if the clock allows.
