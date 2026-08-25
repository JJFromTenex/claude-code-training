# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Ankit Raheja
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants the whole loop in the console: issue a card, see the cards you have issued, open one to check it.

## Current state

Cards do not exist in this application yet. Everything below is what is already there and must be reused rather than reinvented.

- `src/data/types.ts` — `Currency`, `Merchant`, `Payment`, and the rest. There is **no** `Card` type and no `CardStatus`. `Payment` (lines 24–37) carries `last4` and `cardBrand` but **no `cardId`** — nothing links a payment to a card, which is why card spend has no natural source (see Approach).
- `src/data/store.ts` — the in-memory store on `globalThis.__northwindStore`, built once by `createStore()` (line 29) from `generate()`. It holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. A `cards` array has to be added here or writes will not survive a request.
- `src/data/generate.ts` — deterministic seed generation behind `mulberry32(SEED)` (line 21), anchored to `GENERATED_AT = 2026-08-13T00:00:00.000Z` (line 58). `pad()` (line 55) produces the `pay_000001` id style. Note line 101: `last4` is generated as `String(between(1000, 9999))` for payments — that is existing seed data, unrelated to issued cards, and is **not** the `4242` BIN path.
- `src/data/queries.ts` — the one query builder. `parseFilters()` (line 18) is the allowlist pattern to copy: read params, check against a `readonly` tuple, fall back to a safe default. `paginate()` (line 87) is generic over `T` and can paginate cards as-is. **`sortPayments()` line 81 sorts amounts with `String(a.amount).localeCompare(...)`, which orders lexicographically, not numerically** — a pre-existing defect, out of scope here, but do not copy that pattern into card sorting.
- `src/lib/money.ts` — `formatMoney`, `formatMoneyCompact`, `sumMinorUnits`, and `parseAmountToMinorUnits` (line 46), which already handles `"1,250.75"` → `125075` and returns `null` on anything it cannot represent exactly. The issue form's limit field goes through this, not a new parser.
- `src/lib/dates.ts` — `formatDate` (UTC, for tables) and `formatInZone` (merchant timezone, for detail). Both already exist; the card list uses the first and the card detail uses the second, matching `src/app/payments/[id]/page.tsx:71-76`.
- `src/app/api/payments/route.ts` — the route-handler shape: parse via the allowlist helper, hand to the builder, `NextResponse.json`. Four lines. Card routes should be about as thin.
- `src/app/payments/page.tsx` — the list page pattern: server component, `searchParams` promise, `TableRoot`/`Table`, a written empty state at lines 93–104, pagination footer. The cards list mirrors this.
- `src/app/payments/[id]/page.tsx` — the detail page pattern, including the local `Field` component (line 127) and the `← All payments` back link.
- `src/components/` — Button, Input, Select, Badge, Table, Drawer, Divider. **`components.md` claims a `Dialog` exists; it does not.** `@radix-ui/react-dialog@1.1.15` is a dependency and `src/components/Drawer.tsx` is built on it, exporting `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerBody`, `DrawerFooter`, `DrawerClose`, `DrawerTrigger`. Use the Drawer; do not add a dialog dependency.
- `src/components/ui/payments/StatusBadge.tsx` — its `AnyStatus` union is `PaymentStatus | DisputeStatus | PayoutStatus`. Card statuses are not in `LABELS`/`DOTS`/`VARIANTS`, so `StatusBadge` needs `CardStatus` added to the three maps rather than a second badge component.
- `src/components/ui/navigation/AppSidebar.tsx:26` and `src/app/siteConfig.ts:5` — navigation is driven from `siteConfig.baseLinks`. `/cards` must be added in both, plus `LABELS` in `src/components/ui/navigation/Breadcrumbs.tsx:7`, or the breadcrumb renders the raw segment.
- `src/lib/*.test.ts` — vitest, `npm test` runs `vitest run`. `money.test.ts` is the model: `describe` per function, plain `it` names, comments that explain why the case matters.

**Ticket vs. code contradictions:**

1. `merchant-console/CLAUDE.md` says "Seed data is JSON, loaded into a store module at boot" and "If you need more seed data, add it to the JSON." There is no JSON. Seed data is TypeScript in `src/data/generate.ts`. Card seeding follows the code, not the doc.
2. `.claude/rules/components.md` names a `Dialog` component that does not exist. `Drawer.tsx` is the Radix-dialog-based equivalent.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; `$250.00` is `25000` | `CLAUDE.md` conv. 1; `ORG-STANDARDS.md` #1; ticket rule 1 | A float limit drifts and the 5,000,000 ceiling stops meaning anything |
| "Format once, at the edge" — a formatter's output never re-enters arithmetic or storage | `ORG-STANDARDS.md` #2; `money.md` | The stored limit becomes `"$250.00"` and every comparison silently fails |
| "Every generated number starts `4242` and carries a valid Luhn check digit" | `.claude/rules/cards.md`; ticket rule 4 | The repo contains something resembling a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The number is in client bundles and browser memory |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md`; `ORG-STANDARDS.md` #8; ticket rule 2 | A masked UI over a readable field is not masking |
| Mask everywhere else as `•••• 4242` | `.claude/rules/cards.md` | — |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md`; ticket rule 3 | A cancelled card comes back to life via a stale tab or a curl |
| "Validate everything from the client against an allowlist before it reaches the store" | `api-routes.md`; `ORG-STANDARDS.md` #7; `CLAUDE.md` conv. 4 | A limit of `-1`, a currency of `JPY`, or a missing merchant lands in the store |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user" | `api-routes.md` | The form has nothing to display |
| Storage and bucketing are UTC; display converts to the merchant's timezone | `CLAUDE.md` conv. 2; `ORG-STANDARDS.md` #4–5 | `createdAt` drifts a day for Berlin and London merchants |
| Reuse the query builder; a second implementation is a defect | `CLAUDE.md` conv. 3; `ORG-STANDARDS.md` #6 | — |
| "Match the neighborhood"; no `console.log`, no TODOs, no commented-out code | `ORG-STANDARDS.md` #9–10 | — |

## Approach

Cards become a first-class slice that mirrors the payments slice exactly: a `Card` type and `CardStatus` in `src/data/types.ts`, a `cards` array on the store seeded by `generate.ts`, a `src/data/cards.ts` module holding the Luhn generator, the allowlist validator, and the transition guard, three thin route handlers under `src/app/api/cards/`, and two server-component pages under `src/app/cards/`. The stored record carries `last4` and a `reference` — never the number. `POST /api/cards` is the only place a full PAN exists: it is generated server-side on the `4242` BIN, returned once in the creation response, and never written to the store. The issue form is a client component in a `Drawer`; on success it swaps to a success panel showing the full number once, and drops it from state when the drawer closes. Spend is a `spend` field in minor units on the card record, seeded non-zero on some cards and `0` on every newly issued one, because **nothing in this codebase links a payment to a card** and inventing that linkage is a bigger change than the ticket asks for.

**Considered and rejected:** adding `cardId` to `Payment` and deriving spend by summing linked payments through the existing query builder. It is the truthful model and it would have kept spend derived rather than stored (`ORG-STANDARDS.md` #3), but it means changing the payment type, backfilling 120 days of generated payments with card assignments, and reconciling currency per card — a large edit to seed generation for a number the ticket only asks to display. Rejected on clock, and recorded here so the next ticket knows the seam exists.

**Also rejected:** putting the issue form on its own `/cards/new` route. A `Drawer` keeps ops on the list where the new card appears, and `Drawer.tsx` already handles focus trap, Escape, and accessible naming, which `components.md` requires.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus` (`active`/`frozen`/`cancelled`), `Card`, `CardCategory`, and `CardFilters` beside the existing types |
| `src/data/cards.ts` | add | Luhn generator on the `4242` BIN, `validateIssueRequest` allowlist, `canTransition` state-machine guard, `cardById`, `queryCards` — the card equivalent of `queries.ts` |
| `src/data/cards.test.ts` | add | Luhn check digit, `4242` prefix, validation rejections, and every legal and illegal transition |
| `src/data/generate.ts` | change | `generateCards()` producing ~8 seeded cards across merchants, currencies, statuses, and spend levels (one above 80% so the amber bar is demonstrable), using the existing `rand`/`pick`/`pad` helpers |
| `src/data/store.ts` | change | Add `cards: Card[]` to the `Store` interface and `createStore()` so writes persist for the process |
| `src/app/api/cards/route.ts` | add | `GET` list via `queryCards`; `POST` issue — validate, generate, store, return the full number exactly once |
| `src/app/api/cards/[id]/route.ts` | add | `GET` one card, masked |
| `src/app/api/cards/[id]/status/route.ts` | add | `POST` transition, guarded server-side by `canTransition` |
| `src/app/cards/page.tsx` | add | `/cards` list: nickname, merchant, masked number, limit, status, created date, with a written empty state |
| `src/app/cards/[id]/page.tsx` | add | Card detail: full record plus spend against limit |
| `src/app/cards/issue-card-drawer.tsx` | add | Client component: the issue form, and the one-time reveal on success |
| `src/app/cards/card-status-actions.tsx` | add | Client component: freeze/unfreeze from the list without a full page reload |
| `src/app/cards/spend-progress.tsx` | add | Spend bar, amber past 80%, formatted at the edge |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add the three card statuses to `LABELS`, `DOTS`, `VARIANTS` and to the `AnyStatus` union |
| `src/app/siteConfig.ts` | change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add the Cards nav item |
| `src/components/ui/navigation/Breadcrumbs.tsx` | change | Add `cards: "Cards"` to `LABELS` |

## Plan

Core first, in the ticket's order — "Hit the core criteria first — they are what most of the score is." Each step ends somewhere verifiable.

### Core — the six scored criteria

1. **Types and the card module** — add `Card`/`CardStatus` to `types.ts`, then write `src/data/cards.ts` with the Luhn generator, the validator, and `canTransition`. Carry **one** Luhn assertion here — a stub `cards.test.ts` with the `4242` prefix and mod-10 case only — because a check digit cannot be verified by eye and it costs about two minutes. The full suite is step 9. *Done when:* `npx tsc --noEmit` is clean and that one test is green. *(criterion 4)*
2. **Store and seed** — `cards` on the store, `generateCards()` in `generate.ts` using the existing `rand`/`pick`/`pad` helpers. *Done when:* step 3 returns the seeded rows.
3. **List and detail routes** — `GET /api/cards` and `GET /api/cards/[id]`, both masked. *Done when:* `curl localhost:3000/api/cards` shows only `last4` values and no 16-digit run appears anywhere in the body.
4. **Issue route** — `POST /api/cards`, validating against the allowlist and returning the full number exactly once, never writing it to the store. *Done when:* a valid POST returns 201 and a `4242…` number, and each invalid body (missing merchant, `0`, `-1`, `5000001`, `"JPY"`) returns 400 with a user-safe message. *(criterion 6, and the storage half of 5)*
5. **`/cards` list page** — table with nickname, merchant, masked number, limit, status, created date, a written empty state, and `siteConfig`/sidebar/breadcrumb wiring. *Done when:* `/cards` renders the seeded cards and the sidebar link is active. *(criterion 2)*
6. **Card detail page** — full record, UTC and merchant-timezone timestamps, and **spend against the limit as a figure**. The bar is stretch; the number is core. *Done when:* opening a seeded card shows its record and no full number. *(criterion 3)*
7. **Issue drawer with one-time reveal** — the client form, then the success panel, with `onOpenChange` clearing the number. The form **renders the 400 message from step 4**: a rejection ops cannot read makes criterion 6 untestable by the person it was built for, so that much is core and the designed error state is step 12. *Done when:* issuing a card shows the number once, the new card is in the list masked, and reopening the drawer shows no trace of the previous number. *(criteria 1 and 5)*

**Stop and commit here.** Every core criterion is met and scoreable at this point.

### Stretch — dropped from the bottom up if the clock runs out

8. **Freeze and unfreeze from the list** without a full reload — `POST /api/cards/[id]/status`, guarded server-side by `canTransition`.
9. **Full `cards.test.ts`** — expand the step-1 stub to Luhn over many generated numbers, every validation rejection, and every transition including `cancelled` as terminal.
10. **Spend progress bar** — amber past 80%.
11. **Merchant category lock** — server-side allowlist, shown on the card.
12. **Designed empty and error states**, beyond the plain strings from steps 5 and 7.
13. **`/ship-ready`, then commit** — *Done when:* the skill reports clean and commits are prefixed `NWP-201:`.

### Built beyond the plan

The ticket says the reviewer credits what it did not spell out — "the things an
ops tool actually needs once real people click it twice, pick the wrong
currency, or ask what happened to a card last Tuesday". Read literally, that
sentence names three of these four:

14. **Idempotent issue** — `POST /api/cards` honours an `Idempotency-Key`, so a
    double click makes one card. The replay returns the card without the
    number, because the reveal already happened. *(clicks it twice)*
15. **Currency is the merchant's**, enforced server-side and shown as a derived
    read-only field rather than a choice that would be refused. *(picks the
    wrong currency)*
16. **Audit trail** — every status change appends a readable note to the card's
    history, rendered as a timeline on the detail page. *(what happened last
    Tuesday)*
17. **Cancel with a confirmation step**, since `cancelled` is the one state
    nothing comes back from.

### Core criteria coverage

| Ticket core criterion | Step |
| --- | --- |
| Issue a card (nickname, merchant, limit, currency) → appears in list | 7 |
| `/cards` list with all six columns | 5 |
| Card detail: full record and spend against limit | 6 |
| Server-side generation, `4242` BIN, valid Luhn | 1 |
| Reveal once, mask forever | 4 (storage) + 7 (UI) |
| Server-side validation: merchant, ≤ 0, > 5,000,000, currency allowlist | 4 |

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card (nickname, merchant, limit, currency) | Click through the drawer at `/cards`; the new card appears in the list without a manual refresh |
| Card list at `/cards` with all six columns | Load `/cards`; confirm nickname, merchant, masked number, limit, status, created date |
| Card detail shows full record and spend against limit | Open a seeded card with non-zero spend; both render |
| Numbers on the `4242` BIN with a valid Luhn digit | `cards.test.ts`: asserts prefix `4242` and that the Luhn sum mod 10 is 0, over many generated numbers |
| Reveal once, mask forever | `curl` the list and detail routes and grep for a 16-digit run — none. Manually: issue, see the number, close the drawer, reopen — gone |
| Server-side validation | `cards.test.ts` for the validator, plus `curl -X POST` with each bad body (no merchant, `0`, `-1`, `5000001`, `"JPY"`) returning 400 |
| Freeze/unfreeze without full reload (stretch) | Click freeze on the list; the badge changes in place. `curl` a `cancelled → active` transition and confirm 409 |
| Spend progress amber past 80% (stretch) | The seeded over-80% card renders amber; one under it does not |
| Tests (stretch) | `npm test`, output pasted into the PR |

## Risks

- **The full number leaking into the store.** The single highest-cost mistake here. Mitigation: the `Card` type has no field that can hold it — `last4` and `reference` only — so a leak is a type error rather than a review catch.
- **Client state retaining the PAN after the success panel closes.** Mitigation: the drawer's `onOpenChange` clears the reveal state; verified by reopening the drawer in step 8.
- **The 45-minute clock.** Steps 1–8 are the scored core. If time runs short, stretch items are dropped from step 9 in reverse order and the PR says plainly which were not reached.
- **Reimplementing pagination or formatting.** Mitigation: `paginate()` is already generic; `formatMoney` and `formatDate` already exist. A new formatter is a defect under `ORG-STANDARDS.md` #6.
- **Seeded spend is stored, not derived**, which is in tension with `ORG-STANDARDS.md` #3 ("a number shown twice is derived once"). Accepted deliberately because no payment→card link exists; recorded in the PR as a known seam.

## Out of scope

- **Persistence.** No database, no ORM, no migrations. Cards live until the dev server restarts. That is NWP-203.
- **Editing a card's limit after issue.** NWP-202.
- Authentication, roles, permissions.
- Real card network calls.
- **Fixing `sortPayments`' lexicographic amount sort** (`src/data/queries.ts:81`). It is a real defect, found while reading, and it belongs to the payments slice, not this ticket.
- Linking payments to cards via `cardId`.

## Open questions

- The ticket says "see the cards **they** have issued" but authentication is explicitly out of scope, so there is no "they". Building it as *all* cards; if ops meant per-user scoping, that needs an auth ticket first.
- **Merchant category lock** (stretch) names no category list. Planning a small server-side allowlist of common MCC-style groups (`advertising`, `software`, `travel`, `office`, `other`); if ops has a real list, it replaces that constant.
- Whether a cancelled card should stay in the default list view or be filtered out. Planning to show it with its badge, since ops asking "what happened to a card last Tuesday" is exactly the case the ticket hints at.
