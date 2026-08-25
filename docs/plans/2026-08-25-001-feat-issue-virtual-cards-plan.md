---
title: "Issue virtual cards from the console"
type: feat
status: active
created: 2026-08-25
ticket: NWP-201
origin:
  - docs/tickets/NWP-201.md
  - docs/epics/NWP-201-issue-cards.md
target_repo: build-battle/merchant-console
---

# Issue virtual cards from the console

**Target repo:** `build-battle/merchant-console` (all file paths below are relative to this directory, not the training-repo root)

## Summary

Ops currently issues virtual cards by messaging the platform team by hand — twelve to twenty times a week, taking hours, with at least one incident of a wrong spend limit going out because the request lived in a Slack thread. This plan builds card issuance directly into the console: a form to issue a card, a `/cards` list, a detail view, server-generated test-BIN numbers with reveal-once masking, and server-side validation that doesn't trust the client. Core criteria are sequenced first (matching the scoring rubric exactly), stretch goals (freeze/unfreeze, spend bar, category lock, tests, empty/error states) follow as a second wave.

This plan supersedes the informal draft at `transient-cuddling-tulip.md` — same approach, now with two independently-researched corrections folded in (see Key Technical Decisions) and formal test-scenario/requirements traceability added.

---

## Problem Frame

Merchants use virtual cards for vendor subscriptions, ad spend, and contractor tools — single-merchant, always virtual, needing a limit from the moment they exist. Ops needs to issue one, see everything issued, and check one, without leaving the console or waiting on the platform team.

**Success criteria** (from the ticket, in scoring order):
1. Issue a card via a form (nickname, merchant, spend limit, currency) → appears in the list
2. `/cards` list: nickname, merchant, masked number, spend limit, status, created date
3. Card detail: full record, spend against limit
4. Numbers generated server-side, `4242` BIN, valid Luhn check digit
5. Full number shown exactly once (creation success screen), masked (`•••• 4242`) everywhere else
6. Server-side validation rejects: missing merchant, limit ≤ 0, limit > 5,000,000 minor units, currency outside `USD/EUR/GBP`

**Domain rules that must hold throughout** (quoted, not paraphrased):
- "Money is integer minor units. A `$250.00` limit is `25000`. Never a float, never a string with a dollar sign." (`CLAUDE.md`, `.claude/rules/money.md`)
- "Never persist or display a full card number after creation. Store the last four and the generated number's reference." (ticket)
- "Status is a state machine. `active → frozen → active`, and either can go to `cancelled`. `cancelled` is terminal." (ticket, `.claude/rules/cards.md`)
- "The `4242` BIN is not optional... including in tests and fixtures." (ticket, `.claude/rules/cards.md`)
- "Never return a full card number from a list or detail route." (`.claude/rules/api-routes.md`)

---

## Scope Boundaries

**In scope:** all 6 core criteria, all 5 stretch goals (freeze/unfreeze, spend-progress bar, merchant category lock, Luhn/state-machine unit tests, written empty/error states).

**Explicit non-goals** (ticket, do not build):
- Persistence — no database, ORM, or migration. The store is in-memory on purpose; real persistence is NWP-203.
- Authentication, roles, permissions.
- Real card network calls — there is no issuer and there is not going to be one.
- Editing a card's limit after issue — that is NWP-202.

### Deferred to Follow-Up Work
- A "reference" token for the full generated number, as the ticket's own phrasing ("store the last four and the generated number's reference") loosely suggests. Rejected in the epic and reaffirmed here: nothing in scope ever needs to re-derive the number, and storing anything that could reconstruct a full PAN sharpens exactly the risk "reveal once" exists to prevent. `last4` is the only artifact kept.
- Card spend/transaction history. No data source exists anywhere in this store for what a card has spent. Every card renders spend as `0` against its limit — true for every card this store can produce (nothing debits it) rather than fabricated. If real spend tracking becomes a requirement, it's new scope, not part of NWP-201.
- A shared cross-route error-response helper. `POST /api/cards` establishes a small local error shape (see Key Technical Decisions); generalizing it into `src/lib/apiError.ts` for reuse by future routes is worth doing but is not required by this ticket and touches files this ticket doesn't otherwise need to.

---

## Key Technical Decisions

| Decision | Rationale |
| --- | --- |
| Cards get their own query module (`src/data/cardQueries.ts`), not routed through `filterPayments` | Verified via research: no other resource in this codebase (disputes, payouts) has its own query module either — `queries.ts` is the *only* precedent, and it's payment-specific (`merchantId`+`search`+date-range filtering vs. cards' status filtering). `api-routes.md`'s "one query builder" rule is scoped to payments filtering, not to the whole app — there's no existing second pattern being rejected, only the payments pattern being appropriately not force-fit. |
| `POST /api/cards` establishes the error-response shape, not reuses one | Research confirmed: the only two existing route handlers (`api/payments/route.ts`, `api/payments/export/route.ts`) never return a non-200 status — `parseFilters` silently falls back to defaults instead of erroring. There is no shared error helper anywhere in `src/`. `POST /api/cards` will be the first route in this app that actually validates and rejects, so it hand-rolls a small consistent shape: `{ error: string, fields?: Record<string, string> }` at HTTP 422. |
| Card IDs use a local counter, not a shared helper | `generate.ts`'s `pad()` and its seq counters are module-private (not exported). `cardQueries.ts` (or `store.ts`) owns its own `let cardSeq = 0`, formatted `card_000001` to match the existing `pay_/re_/dp_/po_` id shape. |
| `SpendProgress` is hand-rolled with Tailwind | Confirmed: despite `components.md` describing Tremor as a library, there is no `@tremor/react` dependency — "Tremor" components are vendored, hand-copied source files (e.g. `Drawer.tsx` is headed `// Tremor Drawer [v0.0.1]`). No `Progress`/`ProgressBar` component exists anywhere in `src/components/`. Nothing to reuse. |
| Issue form uses the existing `Drawer`, not a new `Dialog` | `components.md` names a `Dialog` component that doesn't exist in `src/components/`. `Drawer.tsx` wraps `@radix-ui/react-dialog`'s `Root` directly and gets Radix's focus trap for free — satisfies "dialogs must be operable" without a new dependency. Confirmed no `Dialog.tsx` exists anywhere in the directory. |
| Cards nav icon is distinct from Payments' | `AppSidebar.tsx:31-36` already uses `CreditCard` (lucide-react) for the Payments nav entry. Reusing it for Cards would be genuinely confusing side-by-side in the same sidebar. Use a distinct icon (e.g. `Wallet`). |
| Card spend renders `0` for every card | No transaction/spend data source exists in this store for cards (confirmed — nothing in `src/data/` ties a spend figure to a card). Rendering `0` is honest given the data; fabricating spend history is out of scope (see Deferred to Follow-Up Work). User confirmed this approach explicitly during planning. |

---

## System-Wide Impact

- **Navigation** (`src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`): adds a fifth top-level nav entry alongside Overview/Payments/Disputes/Payouts.
- **Store** (`src/data/store.ts`): adds the first array in this store that is mutated at runtime rather than only seeded at boot. Every write must mutate `store.cards` in place (push, in-place status update) — never reassign the array — so the `globalThis.__northwindStore` dev-reload guard keeps working.
- **No impact** on payments, disputes, payouts, or the existing query builder — cards are additive and isolated to new files plus the two nav-config touches above.

---

## Implementation Units

### U1. Card type and store slice

**Goal:** Add the `Card`/`CardStatus` types and a mutable `cards` array to the in-memory store, with its own id counter.

**Requirements:** Foundation for all six core criteria; supports stretch category lock via an optional field.

**Dependencies:** None.

**Files:**
- `src/data/types.ts` — modify: add `CardStatus = "active" | "frozen" | "cancelled"`, `CardCategory = "subscriptions" | "advertising" | "contractor_tools" | "other"` (stretch, optional on `Card`), and `Card { id, nickname, merchantId, last4, limit, currency: Currency, status, category?, createdAt }`
- `src/data/store.ts` — modify: add `cards: Card[]` to `Store`, `[]` in `createStore()`

**Approach:** `limit` is integer minor units (money rule). `last4` only — never a full-number field on this type, so there is no field to accidentally serialize. Id counter (`let cardSeq = 0`, `card_${pad(++cardSeq)}`) lives in `cardQueries.ts` (U2) since `generate.ts`'s `pad` is private and cards aren't seeded — don't try to import it.

**Patterns to follow:** `src/data/types.ts:24-37` (`Payment` interface shape, inline doc comments for non-obvious fields like "Integer minor units. Never a float."); `src/data/store.ts:16-22` (`Store` interface).

**Test scenarios:**
Test expectation: none — type/interface addition only, no behavior to test directly (covered indirectly by every later unit's tests).

**Verification:** `npm run build` (or `tsc --noEmit`) succeeds with the new types in place and an empty `cards: []` wired through.

---

### U2. Card number generation (Luhn) and query module

**Goal:** Server-side card-number generation on the `4242` test BIN with a valid Luhn check digit, masking, and the full `cardQueries.ts` module (validation, create, list, get, status-transition guard).

**Requirements:** Core criteria 4 (generated numbers) and 6 (server-side validation); foundation for criteria 1, 2, 3, 5; stretch: state-machine tests, freeze/unfreeze.

**Dependencies:** U1.

**Files:**
- `src/lib/cardNumber.ts` — new: `generateCardNumber()`, `luhnCheckDigit(partial: string): string`, `maskCardNumber(last4: string): string`
- `src/lib/cardNumber.test.ts` — new
- `src/data/cardQueries.ts` — new: `parseIssueCardInput`, `createCard`, `parseCardFilters`, `queryCards`, `cardById`, `updateCardStatus`
- `src/data/cardQueries.test.ts` — new

**Approach:** `generateCardNumber()` builds a 15-digit string starting `4242` + 11 random digits, computes the Luhn check digit for a 16th, returns the full 16-digit number. `maskCardNumber` returns `"•••• " + last4` per `cards.md`'s literal format. `parseIssueCardInput(body: unknown)` is the allowlist boundary: validates `merchantId` against `merchants` (from `src/data/merchants.ts`), `limit` is a positive integer ≤ 5,000,000, `currency` is `"USD" | "EUR" | "GBP"` — returns `{ ok: true, value }` or `{ ok: false, fields: Record<string,string> }`, never throws. `createCard(input)` generates the number, derives `last4` from it, builds the `Card` record (no full-number field), pushes to `store.cards`, returns `{ card, number }` — `number` exists only in this function's return value and the one API response that calls it. `updateCardStatus(id, next)` enforces: `active↔frozen` either direction; `active|frozen → cancelled`; `cancelled` → reject any transition (return an error result, not throw).

**Patterns to follow:** `src/lib/money.ts:46-52` (`parseAmountToMinorUnits` — boundary-parse-and-validate shape, returns `null` rather than throwing); `src/data/queries.ts:18-36` (`parseFilters` allowlist shape) and `:102-106` (`queryPayments` compose pattern); `src/lib/money.test.ts` (test file shape/describe blocks to mirror for `cardNumber.test.ts`).

**Test scenarios:**
- Happy path: `generateCardNumber()` returns a 16-digit string starting with `4242`
- Happy path: the returned number passes Luhn validation
- Edge case: run `generateCardNumber()` in a loop (e.g. 200 iterations) — every result starts `4242` and passes Luhn (guards against a probabilistic bug in the random digits)
- Happy path: `maskCardNumber("4242")` returns `"•••• 4242"`
- Happy path: `parseIssueCardInput` accepts a fully valid body and returns `ok: true`
- Error path: `parseIssueCardInput` rejects a missing/unknown `merchantId`
- Error path: `parseIssueCardInput` rejects `limit: 0` and `limit: -100`
- Edge case: `parseIssueCardInput` rejects `limit: 5_000_001` and accepts exactly `5_000_000`
- Error path: `parseIssueCardInput` rejects `currency: "JPY"`
- Happy path: `createCard` returns a `card` with `last4` set and no full-number field, and a top-level `number` matching `luhnCheckDigit`/BIN rules
- Integration: `updateCardStatus` — `active → frozen → active` succeeds both directions
- Integration: `updateCardStatus` — `active → cancelled` and `frozen → cancelled` both succeed
- Integration: `updateCardStatus` — any transition attempted from `cancelled` is rejected (state unchanged)

**Verification:** `npm test` passes for both new test files.

---

### U3. `POST /api/cards` and `GET /api/cards`

**Goal:** Route handlers for issuing a card and listing cards.

**Requirements:** Core criteria 1, 2, 4, 5, 6.

**Dependencies:** U2.

**Files:**
- `src/app/api/cards/route.ts` — new

**Approach:** `POST` reads the JSON body, calls `parseIssueCardInput`; on failure returns `NextResponse.json({ error: "Invalid card request", fields }, { status: 422 })` (this is the shape U2/this ticket establishes — see Key Technical Decisions); on success calls `createCard` and returns `NextResponse.json({ card, number })` with 201. `GET` parses query params via `parseCardFilters`, returns `queryCards(filters)` via `NextResponse.json`. Neither response path ever includes a full number outside the `POST` success response.

**Patterns to follow:** `src/app/api/payments/route.ts:1-7` (two-line handler: parse, call store function, return JSON).

**Test scenarios:**
Test expectation: none as a separate automated suite — this unit is proven by manual/API verification (below) since the app has no existing route-handler test pattern to extend and adding one is disproportionate to a two-handler file; the underlying logic (`parseIssueCardInput`, `createCard`, `queryCards`) is already covered by U2's tests.

**Verification:** Manual — `POST /api/cards` with a fully valid body returns 201 with `number` present and `card.last4` set, no full-number field on `card`. `POST` with each of the four invalid cases from core criterion 6 (missing merchant, limit 0, limit 5,000,001, currency `"JPY"`) returns 422 with a field-level message. `GET /api/cards` after two `POST`s returns both, neither with a full number.

---

### U4. `/cards` list page and navigation

**Goal:** The `/cards` route rendering the list table, plus sidebar/siteConfig entries making it reachable.

**Requirements:** Core criterion 2; stretch: written empty state.

**Dependencies:** U3.

**Files:**
- `src/app/cards/page.tsx` — new
- `src/app/siteConfig.ts` — modify: add `cards: "/cards"` to `baseLinks`
- `src/components/ui/navigation/AppSidebar.tsx` — modify: add a Cards nav entry using a distinct icon (e.g. `Wallet` from `lucide-react` — not `CreditCard`, already used by Payments)

**Approach:** Server component. Fetches via `queryCards` directly (server-side, same-process — no need to hit the API route from a server component, matching `payments/page.tsx`'s direct-import pattern) or via `fetch` to `GET /api/cards` if consistency with a client-refresh path is preferred; either is acceptable but must be decided consistently with U6's post-create refresh strategy. Table columns: nickname, merchant name (via `merchantById`), masked number (`•••• ${last4}`), limit (`formatMoney(limit, currency)`), status (`StatusBadge`, extended in U7 or inline here), created date (`formatDate`). Written empty state for zero cards, not a bare table.

**Patterns to follow:** `src/app/payments/page.tsx:30-160` (full server-component + table pattern), especially the empty-state block at `:93-104`.

**Test scenarios:**
Test expectation: none — this is a server-rendered page verified via manual browser check per the plan's overall verification strategy (matches how `payments/page.tsx` is verified in this codebase — no page-level test convention exists to extend).

**Verification:** `/cards` renders in the browser with the written empty state before any card exists; reachable via the sidebar; after issuing a card (U6), the new row appears with correct masked number, limit, status, and date formatting.

---

### U5. Card detail page and `GET /api/cards/[id]`

**Goal:** Detail route and page showing the full (masked) record and spend against limit.

**Requirements:** Core criterion 3; stretch: spend-progress bar.

**Dependencies:** U3.

**Files:**
- `src/app/api/cards/[id]/route.ts` — new: `GET` handler
- `src/app/cards/[id]/page.tsx` — new
- `src/components/ui/cards/SpendProgress.tsx` — new (stretch)

**Approach:** `GET /api/cards/[id]` calls `cardById`, 404 via `NextResponse.json({ error: "Card not found" }, { status: 404 })` if missing, otherwise returns the record with `last4` only. Detail page mirrors `payments/[id]/page.tsx`: `notFound()` for a missing id, fields for nickname/merchant/masked number/limit/currency/status/created date. Spend renders as `0` against `limit` (see Key Technical Decisions — no data source exists) via `SpendProgress`, built as a genuinely correct component (ratio-based fill, amber past 80%) even though it will always show empty against this store's real data.

**Patterns to follow:** `src/app/payments/[id]/page.tsx:14-140` (full detail-page pattern, including the `Field` helper component at `:127-140`).

**Test scenarios:**
- Happy path (manual/browser): opening a card from the list shows its full record
- Error path: navigating to `/cards/does-not-exist` triggers `notFound()` (404 page, not a crash)
- Happy path (`SpendProgress`, isolated): given `spend: 0, limit: 25000`, renders an empty/near-empty bar
- Edge case (`SpendProgress`, isolated): given a spend ratio ≥ 0.8, the bar renders amber
- Edge case (`SpendProgress`, isolated): given a spend ratio ≥ 1.0 (over limit), the bar does not overflow its container or crash

Test expectation for the manual/browser scenarios: none as automated tests (matches U4's rationale — no page-test convention in this codebase); the three `SpendProgress` scenarios should be actual unit tests since it's a pure presentational component with clear inputs/outputs (add `src/components/ui/cards/SpendProgress.test.tsx` if a component-test pattern exists elsewhere in the repo — if not, verify manually with hardcoded props and note the gap rather than inventing a new test-runner config for one component).

**Verification:** Manual — open a card's detail page from the list, confirm full record and `0` spend against the limit render correctly; confirm a bad id 404s.

---

### U6. Issue-card form and reveal-once success screen

**Goal:** The client-side form (nickname, merchant, limit, currency) that creates a card, and the one-time full-number reveal.

**Requirements:** Core criteria 1, 5; stretch: category lock, written error state.

**Dependencies:** U3, U4.

**Files:**
- `src/components/ui/cards/IssueCardDrawer.tsx` — new

**Approach:** Client component built on the existing `Drawer` (`src/components/Drawer.tsx`), not a new `Dialog`. Fields: nickname (`Input`), merchant (`Select`, options from `merchants` in `src/data/merchants.ts`), limit (`Input`, client-side preview via `parseAmountToMinorUnits` from `src/lib/money.ts` — display convenience only, server validation in U2/U3 is authoritative), currency (`Select`, defaulted to the selected merchant's `currency`, all three options always selectable per the ticket), category (`Select`, stretch, options `subscriptions/advertising/contractor_tools/other`). On submit, `POST`s to `/api/cards`; on 422, renders the field errors inline (written error state, not a console-only failure); on success, swaps the form for a success view showing the full `number` in a monospace field with a clear "won't be shown again" message and a copy affordance. Closing the drawer discards all component state — the full number was never written anywhere else, so there's no path back to it (enforced structurally by U2/U3, not just by this component hiding it). After a successful create, trigger the list refresh (`router.refresh()` if U4 used server-side fetch, or a re-fetch if client-side) — must match whichever strategy U4 settled on.

**Patterns to follow:** `src/components/Drawer.tsx` (full Root/Trigger/Close/Portal/Overlay/Content stack, Radix focus trap); `src/components/Input.tsx`, `src/components/Select.tsx` (existing form controls — reuse, don't reinvent); `components.md`'s operability rule (every input labelled, accessible name, focus in/out, Escape closes — Radix gives most of this for free via `Drawer`).

**Test scenarios:**
- Happy path (manual/browser): fill all fields validly, submit, confirm the success screen shows a 16-digit number starting `4242`
- Happy path (manual/browser): close the success screen, confirm the new card appears in the `/cards` list with only `•••• <last4>` visible
- Error path (manual/browser): submit with the server rejecting (simulate by bypassing client validation, e.g. devtools-edited request, or a limit that passes client parsing but somehow fails — more realistically, verify via U3's direct API tests plus one manual UI check that a 422 response renders the written error state rather than failing silently)
- Edge case (manual/browser): after closing the success screen, reopening the drawer for a new card issuance never shows the previous number

Test expectation: none as automated tests — this is a client form verified via manual browser interaction; no client-component test harness exists in this codebase to extend (`vitest` is configured but no `@testing-library/react` or similar is in `package.json`'s devDependencies per the research findings — introducing one is disproportionate to this ticket's scope).

**Verification:** Full manual walkthrough in the browser: issue a card → see the number once → list shows it masked → detail shows it masked → reopening the issue drawer shows a clean form, no leaked state.

---

### U7. Freeze/unfreeze (stretch)

**Goal:** Toggle a card's status from `active` to `frozen` and back, without a full page reload.

**Requirements:** Stretch — freeze/unfreeze.

**Dependencies:** U2, U4, U5.

**Files:**
- `src/app/api/cards/[id]/route.ts` — modify: add `PATCH` handler
- `src/app/cards/page.tsx` or `src/app/cards/[id]/page.tsx` — modify: add the toggle control (client-side island)
- `src/components/ui/payments/StatusBadge.tsx` — modify: extend `AnyStatus` union with `CardStatus`, add labels/dots/variants for `active`/`frozen`/`cancelled` (reuse the existing badge rather than a new `cards/StatusBadge.tsx`)

**Approach:** `PATCH /api/cards/[id]` reads `{ status: CardStatus }` from the body, calls `updateCardStatus` (U2), returns the updated card or a 409/422 if the transition is invalid. The toggle is a small client component using `fetch` + local state update (not a `<Link>`/navigation) so the row updates without a reload. `cancelled` cards render no toggle at all — the terminal state has nothing to offer.

**Patterns to follow:** `src/components/ui/payments/StatusBadge.tsx:1-62` (extend the existing `Record<AnyStatus, ...>` pattern rather than duplicating the component).

**Test scenarios:**
- Happy path (manual/browser): toggle an `active` card to `frozen` from the list, confirm the row updates with no navigation/reload
- Happy path (manual/browser): toggle it back to `active`
- Edge case (manual/browser): a `cancelled` card (create one via direct API call, e.g. `PATCH` to `cancelled` first) shows no toggle control
- Error path: `PATCH` a `cancelled` card's status via direct API call, confirm the route rejects it (covered by U2's `updateCardStatus` unit tests functionally; this is the route-level pass-through check)

**Verification:** Manual browser + one direct `PATCH` call against a `cancelled` card confirming rejection.

---

## Verification Strategy

- **Automated:** `npm test` — `cardNumber.test.ts` (U2), `cardQueries.test.ts` (U2), and `SpendProgress` tests if a component-test pattern is added (U5).
- **Manual, browser, in scoring order:** issue a card (U6) → appears in `/cards` (U4) → open detail, see full record + `0` spend (U5) → confirm every generated number in this session starts `4242` and is valid Luhn (spot-check, backed by U2's automated coverage) → confirm the number is shown once and masked everywhere after (U6, U4, U5) → confirm empty state before any card exists (U4) → freeze/unfreeze without reload (U7) → spend bar amber-past-80% with hardcoded/isolated props (U5) → category shown and immutable (U6).
- **Manual, API:** `POST /api/cards` with each of the four invalid-input cases from core criterion 6, confirming 422 + message (U3). `GET /api/cards` and `GET /api/cards/[id]` responses inspected to confirm no full card number ever appears outside the single `POST` creation response (U3, U5).
- **Before pushing:** `npm test`, then `/ship-ready`, per the ticket's definition of done.

---

## Risks

- **`store.cards` is the first runtime-mutated array in this store.** If any handler ever reassigns `store.cards` instead of mutating in place, the `globalThis.__northwindStore` dev-reload guard could hand other requests a stale reference. Mitigation: all writes go through `cardQueries.ts` functions (`createCard`, `updateCardStatus`), and both mutate in place — no other file should touch `store.cards` directly.
- **No client-component or route-handler test harness exists in this codebase.** Several units above (U3, U4, U5's page-level checks, U6) rely on manual verification rather than automated tests because introducing `@testing-library/react` or a route-handler test setup is disproportionate to this ticket. This is a real coverage gap, not a false claim of automated verification — flagged explicitly per unit above rather than glossed over.
- **Spend is always `0` against every card's limit** (see Key Technical Decisions) — core criterion 3 and the stretch progress bar are both real but will never show a nonzero value against this store's actual data. Confirmed acceptable with the user during planning.

## Open Questions

None outstanding — the two questions raised during the informal draft (currency-vs-merchant matching, category enum values) were resolved: currency has no server-side merchant constraint per the ticket (form defaults to the merchant's currency as a UI convenience only); category enum drawn directly from the ticket's own description (`subscriptions`, `advertising`, `contractor_tools`, `other`).
