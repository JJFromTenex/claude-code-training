# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** mayank
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards got the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card in the console, see the cards they've issued, and open one to check it — with a limit from the moment the card exists.

(All paths below are under `build-battle/merchant-console/` unless they start with `docs/`.)

## Current state

- **Nothing card-issuing exists.** Grep for `luhn|4242|freeze|issu` finds only a test fixture (`src/lib/csv.test.ts:20`) and payment-instrument metadata `cardBrand`/`last4` on `Payment` (`src/data/types.ts:32-33`).
- **Store** is a bare object on `globalThis` (`src/data/store.ts:16-38`), no getters/mutators; pages read/mutate slices directly (`src/app/disputes/page.tsx:20`). A `cards` slice must be added to the `Store` interface and `createStore()`.
- **Seed data is NOT JSON** despite `CLAUDE.md:18` — it's generated deterministically in `src/data/generate.ts` (seeded PRNG `mulberry32`, `:16-31`; anchor `GENERATED_AT`, `:58`). Seed cards go there. ID convention: `pad()` at `generate.ts:55` → `crd_000001`.
- **Merchants**: 10 hardcoded in `src/data/merchants.ts:7-88`, each pinned to one `currency` (`src/data/types.ts:20`); `merchantById` at `merchants.ts:90`. Picker-feeding pattern: `src/app/payments/page.tsx:61`.
- **API routes**: only two GET handlers (`src/app/api/payments/route.ts`, `.../export/route.ts`). **No POST/PATCH, no body parsing, no error shape exists anywhere** — we establish it: `{ message }` JSON with an honest status code, per `.claude/rules/api-routes.md`. Allowlist-validation idiom to copy: `parseFilters()` in `src/data/queries.ts:18-36`.
- **Money helpers exist — use them** (`src/lib/money.ts`): `formatMoney` `:15`, `sumMinorUnits` `:41`, `parseAmountToMinorUnits` `:46` (this parses the limit field). Do NOT use legacy `formatters.currency` in `src/lib/utils.ts:64-97` (major units).
- **Dates**: `formatDate` (tables), `formatInZone` (merchant-tz display) in `src/lib/dates.ts`.
- **UI to reuse**: `src/components/Table.tsx`; `src/components/Drawer.tsx` (the Radix dialog wrapper — `components.md:9` mentions a `Dialog` that does not exist); `Input`/`Select`/`Button` in `src/components/`; `StatusBadge` (`src/components/ui/payments/StatusBadge.tsx:5-61`) — add `CardStatus` entries to its `LABELS`/`DOTS`/`VARIANTS`. Empty-state idiom: `src/app/payments/page.tsx:93-104`. Detail page + timeline `<ol>` pattern: `src/app/payments/[id]/page.tsx:28-38, 87-104, 127-140`. Threshold-color ternary for the spend bar: `src/app/disputes/page.tsx:77-84`. No toast lib, no progress-bar component, **no `<label>` anywhere yet** (`components.md` requires labels — we'll be first).
- **Route registration is three edits**: `src/app/siteConfig.ts:5-10`, `src/components/ui/navigation/AppSidebar.tsx:26-51` (lucide icon), `src/components/ui/navigation/Breadcrumbs.tsx:7-12`.
- **Tests**: Vitest, `include: src/**/*.test.ts` only — `.test.ts` not `.tsx` (`vitest.config.ts:10-16`); colocated in `src/lib/`; `npm test` = `vitest run`.
- **Do not copy the planted-bug idioms nearby**: string-compare amount sort (`src/data/queries.ts:79-82`), local-time bucketing + float accumulation (`src/data/metrics.ts:25,31-43`), `/100` outside a formatter (`src/data/analytics.ts:54`).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." Format once, at the edge | `CLAUDE.md:39`, `.claude/rules/money.md` | Cents drift; scored defect |
| "Generated numbers use the `4242` test BIN and a valid Luhn check digit" | `CLAUDE.md:46`, `rules/cards.md` | Repo could resemble real PANs |
| "The full number is returned exactly once, in the creation response. After that, last four only." Stored records carry "the last four and a reference, never the number" | `CLAUDE.md:47`, `docs/ORG-STANDARDS.md` #8 | PAN leakage; auto-graded |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal." "Guard the transition on the server" | `CLAUDE.md:48`, `rules/cards.md` | Zombie cancelled cards |
| "Validate on the server… against an allowlist" — reject missing merchant, limit ≤ 0 or > 5,000,000 minor units, currency ∉ {USD, EUR, GBP} | `CLAUDE.md:42`, ticket | Client-trust defect |
| "Storage and bucketing are UTC" — card `createdAt` and event timestamps ISO-8601 UTC | `CLAUDE.md:40`, `src/data/types.ts:35` | Timezone drift |
| Card currency must equal the merchant's currency (decision; merchants are single-currency, `types.ts:20`) | this epic | The "picked the wrong currency" failure the ticket hints at |
| "Generate on the server. A card number produced in the browser is a bug" | `rules/cards.md` | Core criterion failed |

## Approach

Add a `Card` domain: types in `src/data/types.ts`, pure logic (Luhn generation on the 4242 BIN, masking, status-transition guard) in a new `src/lib/cards.ts` with tests beside it, a `cards` slice seeded deterministically in `src/data/generate.ts`/`store.ts`. Mutations go through new route handlers — `POST /api/cards` (validate, generate server-side, return the full number exactly once) and `PATCH /api/cards/[id]` (guarded freeze/unfreeze/cancel). Pages follow the payments neighborhood: `/cards` server-rendered table with an issue Drawer (client) and in-row freeze toggle; `/cards/[id]` server-rendered detail with spend bar and an event timeline reusing the payments timeline pattern. Cards carry `spentMinorUnits` (seeded; 0 for new) and an `events[]` audit trail (issued/frozen/unfrozen/cancelled) so "what happened to a card last Tuesday" has an answer.

**Considered and rejected:** deriving spend by linking payments to cards via a new `cardId` — touches `Payment` seed data, invents a join the ticket doesn't ask for, and burns clock for no scored credit. Also rejected: a generic Dialog component (Drawer already is the Radix dialog wrapper) and any client-side number generation.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardEvent`, `Card` (id, merchantId, nickname, last4, numberRef, limit+spent minor units, currency, categoryLock, status, createdAt, events) with the existing doc-comment conventions |
| `src/lib/cards.ts` | add | Luhn check digit + 4242-BIN generation, `maskCard`, allowed-transition guard — pure, testable |
| `src/lib/cards.test.ts` | add | Stretch: unit tests on Luhn + transitions, beside the code (`.test.ts` so Vitest picks it up) |
| `src/data/generate.ts` | change | Deterministic seed cards (varied merchants/statuses; one past 80% spend) |
| `src/data/store.ts` | change | `cards: Card[]` in `Store` + `createStore()` |
| `src/app/api/cards/route.ts` | add | POST: allowlist validation (merchant exists, 0 < limit ≤ 5,000,000, currency ∈ allowlist ∧ = merchant's), one-time full-number response; establishes `{ message }` error shape |
| `src/app/api/cards/[id]/route.ts` | add | PATCH: freeze/unfreeze/cancel, transition guarded server-side, 409 on illegal moves |
| `src/app/cards/page.tsx` | add | List: nickname, merchant, `•••• last4`, limit (`formatMoney`), status pill, created date; written empty state |
| `src/app/cards/issue-card-drawer.tsx` | add | Client form (labels on every input, currency defaults to merchant's, category lock select), reveal-once success view, submit-disabled double-click guard, clears PAN from state on close |
| `src/app/cards/card-row-actions.tsx` | add | Client freeze/unfreeze without full reload (`router.refresh` after PATCH) |
| `src/app/cards/[id]/page.tsx` | add | Detail `<dl>`, spend-vs-limit bar (amber past 80%), event timeline |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add `active`/`frozen`/`cancelled` entries to `LABELS`/`DOTS`/`VARIANTS` |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`, `src/components/ui/navigation/Breadcrumbs.tsx` | change | Register `/cards` in nav + breadcrumbs |

## Plan

1. **Types + `src/lib/cards.ts` + tests** — done when: `npm test` passes with Luhn (4242 prefix, valid check digit, 16 digits) and transition tests green.
2. **Store slice + seed cards** — done when: dev server boots and seeded cards are deterministic across reloads.
3. **`POST /api/cards`** — done when: a curl issues a card (full number in this response only) and each invalid payload gets a 400 with `{ message }`.
4. **`PATCH /api/cards/[id]`** — done when: active⇄frozen works, cancel works from both, any transition out of cancelled gets 409.
5. **`/cards` list + nav registration** — done when: seeded cards render masked; empty-state copy shows when the list is empty.
6. **Issue drawer** — done when: created card appears in list; full number visible once on success, gone after close; double-click creates one card.
7. **`/cards/[id]` detail + spend bar + timeline** — done when: the seeded >80% card shows an amber bar; events render in order.
8. **Freeze/unfreeze from list** — done when: pill flips in place, no full page reload.
9. **`npm test`, lint, `/ship-ready`** — done when: all clean, no `console.log`/TODO debris.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Drawer submit → card in list (browser) |
| Card list at `/cards` | Visit route; check the six columns |
| Card detail | Open a seeded card; fields + spend vs limit |
| 4242 BIN + Luhn, server-side | `src/lib/cards.test.ts` via `npm test`; generation lives only in the route handler path |
| Reveal once, mask forever | Create → note full number → close → confirm `•••• last4` everywhere; GET payloads carry no full number |
| Server-side validation | curl the POST with missing merchant, limit 0 / −1 / 5,000,001, currency `JPY`, mismatched currency → 400s |
| Freeze/unfreeze (stretch) | Toggle in list, no reload; illegal cancel-revive → 409 via curl |
| Spend bar amber >80% (stretch) | Seeded card past 80% renders amber |
| Category lock (stretch) | Chosen at issue, shown on list/detail |
| Tests (stretch) | `npm test` green |
| Empty/error states (stretch) | Empty list copy; form field errors surfaced from server messages |

## Risks

- **Clock (45 min).** Steps are ordered core-first; stop after any step and the work still stands.
- **PAN lingering in client state** after the success screen — clear it on drawer close; never store it.
- **Next 15 dynamic params are async** — follow the existing `src/app/payments/[id]/page.tsx` pattern exactly.
- **`vitest` include glob is `.test.ts` only** — keep tests pure-TS or they silently never run.

## Out of scope

- Persistence (NWP-203) — no DB, ORM, migrations. Cards vanish on dev-server restart, by design (`CLAUDE.md:21`).
- Editing a limit after issue (NWP-202), auth/roles, real card-network calls.

## Open questions

- Category-lock values aren't specified anywhere — using a small fixed allowlist (advertising, software, shipping, office, travel) validated server-side; adjust at review.
