# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Moaaz Elsayed
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue a card from the console, see the cards they have issued, and open one to check it.

## Current state

All paths relative to `build-battle/merchant-console/`. There is no card code anywhere yet; `CLAUDE.md` says so ("Cards is NWP-201 and does not exist yet").

- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"` exists as a type only; there is no runtime allowlist of currencies anywhere. `Merchant` carries `currency` and `timezone`. Amounts are documented as integer minor units.
- `src/data/store.ts` — one in-memory `Store` held on `globalThis`, built once by `generate()` in `src/data/generate.ts`. Adding a collection means adding it to `Store` and to `createStore()`. `generate()` uses a seeded PRNG in sequence, so anything new must be generated **after** payouts to keep the existing payment data byte-identical.
- `src/data/queries.ts` — the payment query builder plus `parseFilters`, the model for server-side allowlist parsing. `paymentById`, `refundsForPayment` show the lookup style. `src/data/merchants.ts` exports `merchants` and `merchantById`, which is the merchant existence check the ticket needs.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` is the only formatter; `parseAmountToMinorUnits(input)` already turns `"250.00"` into `25000` at the boundary and rejects anything it cannot represent. Both are tested in `src/lib/money.test.ts`. No new money code is needed.
- `src/lib/dates.ts` — `formatDate(iso)` for table cells, `formatInZone(iso, tz)` for detail pages.
- `src/app/api/payments/export/route.ts` — the only route with a 400 path; it sets the error shape `NextResponse.json({ error }, { status })`.
- `src/app/payments/page.tsx` and `src/app/payments/[id]/page.tsx` — async server components: `TableRoot`/`Table` from `src/components/Table.tsx`, `StatusBadge`, a written empty state, `notFound()` on a missing id, a `Field` dl layout and a timeline list on the detail page. `src/components/ui/payments/StatusBadge.tsx` is a typed union over `PaymentStatus | DisputeStatus | PayoutStatus` and needs card statuses added.
- `src/components/` — Button (`primary`, `secondary`, `light`, `ghost`, `destructive`, `isLoading`), Input, Select (Radix), Badge, Drawer (Radix dialog: focus trap, focus return, Escape, `DrawerTitle` as the accessible name). There is no `Dialog.tsx`; Drawer is the dialog.
- `src/components/ui/navigation/AppSidebar.tsx` and `Breadcrumbs.tsx` — hard-coded nav lists keyed off `src/app/siteConfig.ts`; Cards must be added to all three.
- `vitest.config.ts` — Node environment, `src/**/*.test.ts`, no jsdom. Component tests are not possible; route handlers and pure modules are.
- **Does not match the ticket:** the ticket says the store is "seeded from JSON". It is generated in `src/data/generate.ts`; there is no JSON. Seed cards go there.
- **Environment defect found while baselining:** `npm test` fails to start on Node 18 (`ERR_REQUIRE_ESM`: the lockfile resolved vite 7, which needs Node 20+, and `vite-tsconfig-paths` 6 is ESM-only while the config loads as CJS). Fixed before any feature work by pinning vite to `^6` and renaming the config to `vitest.config.mts`. 28 tests pass on Node 18 afterwards.
- **Pre-existing bugs found by `bug-investigator`** (in scope to fix because they are mechanical and the codebase's own rules call them defects): `sortPayments` compares amounts as strings (`src/data/queries.ts:81`); `dailyVolume` buckets by server-local `toLocaleDateString` and accumulates floats (`src/data/metrics.ts:25-34`); `parseFilters` accepts a fractional `page` (`src/data/queries.ts:32`). Cross-currency sums in `metrics.ts`/`analytics.ts` and the refund series are product decisions and are **not** touched; they go in the PR notes.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge" | `CLAUDE.md` conventions §1, `.claude/rules/money.md` | A float limit drifts; a formatted string in the store cannot be compared to spend |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures" | `.claude/rules/cards.md` | Repo contains something that looks like a real card |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | Client-generated numbers are untrusted and leak the generator |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md`, `api-routes.md` | Rule 8 of ORG-STANDARDS; a re-readable PAN |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI" | `.claude/rules/cards.md`, ticket rule 3 | A cancelled card comes back to life |
| "Validate everything from the client against an allowlist before it reaches the store" — missing merchant, zero/negative limit, limit above 5,000,000 minor units, currency outside USD/EUR/GBP | `.claude/rules/api-routes.md`, ticket core criterion 6 | The wrong-limit incident that motivates the ticket |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user" | `.claude/rules/api-routes.md` | The dialog cannot show why a card was refused |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it"; "Write the empty and error states" | `.claude/rules/components.md` | Keyboard and screen-reader tie-breaks; a blank table |
| "No database, no ORM, no migrations" | ticket out-of-scope, `build-battle/CLAUDE.md` | Zero points and lost clock |

## Approach

Build server-side first and make every layer testable without a browser. One pure module, `src/lib/cards.ts`, owns everything that has a rule attached: the `4242` BIN, the Luhn check digit, masking, the status transition table, the spend-limit ceiling, the currency and category allowlists, and `parseIssueCardInput`, which turns an unknown request body into a typed, validated input or a user-safe error message. A store module, `src/data/cards.ts`, mirrors `queries.ts`: `listCards`, `cardById`, `issueCard`, `transitionCard`. `issueCard` generates the number, stores only `last4` plus an opaque `numberRef`, and returns the full number **once** as a separate value that never sits on the record. Route handlers are thin: `POST /api/cards` validates then issues and returns 201 with `{ card, number }`; `GET /api/cards` and `GET /api/cards/[id]` return masked records; `PATCH /api/cards/[id]` takes `{ status }` and answers 409 when the state machine refuses. The API contract for money is minor units: the dialog converts what ops types with the existing `parseAmountToMinorUnits` (so it can show an inline error before submitting) and posts an integer; the server still rejects anything that is not a safe positive integer within range, because the client is not trusted.

The UI reuses the payments pages' shape. `/cards` is a server component reading `listCards()`; the row actions and the issue dialog are small client components. Freeze, unfreeze, and cancel call the PATCH route and then `router.refresh()`, which re-renders the server component in place with no full page load and keeps the store as the single source of truth. Cancel is terminal, so the row asks for a second click before sending it. The success screen shows the full number with a copy button, and closing the drawer clears it from state. The detail page shows the full record, `SpendProgress` (a labelled progressbar that turns amber past 80%), and an event timeline (issued, frozen, unfrozen, cancelled) so ops can see what happened to a card last Tuesday. The form defaults the currency to the selected merchant's currency so picking the wrong one takes effort. `StatusBadge` gains the three card statuses rather than a second badge component.

**Considered and rejected:**
- *Optimistic client-side list state for freeze/unfreeze.* Rejected: two sources of truth for status, and `router.refresh()` already updates without a reload. If it ever feels slow the row shows a pending spinner via `Button isLoading`.
- *Posting the limit as a `"250.00"` string and parsing on the server.* Rejected in favour of a minor-units integer contract: it matches every other amount in the API and lets the server validation be a pure integer range check. The one boundary conversion still happens exactly once, in the dialog, using the existing helper.
- *A `Dialog.tsx` component.* Rejected: Drawer is the console's Radix dialog and NWP-101 already established it as the pattern.
- *Using `Idempotency-Key` headers to guard double submit.* Rejected as over-build; the submit button is disabled while the request is in flight, which is what stops the second click.
- *Generating card spend from payments.* Rejected: payments are inbound merchant volume, not card spend. `spent` is a field in minor units, seeded for the demo cards and zero for new ones.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Change | `CardStatus`, `CardCategory`, `Card`, `CardEvent`, `IssueCardInput` |
| `src/lib/cards.ts` | Add | BIN, Luhn, generator, mask, limits, allowlists, transitions, `parseIssueCardInput` |
| `src/lib/cards.test.ts` | Add | Luhn, generator on `4242`, mask, every legal and illegal transition, every validation rule |
| `src/data/cards.ts` | Add | `listCards`, `cardById`, `issueCard`, `transitionCard` against the store |
| `src/data/cards.test.ts` | Add | Record stores last four and ref only; full number returned once; transitions guarded; events appended |
| `src/data/generate.ts` | Change | Seed a handful of cards after payouts so the list and progress bar have data |
| `src/data/store.ts` | Change | Add `cards` to `Store` |
| `src/app/api/cards/route.ts` | Add | `GET` list (masked), `POST` issue (validate, 400/201) |
| `src/app/api/cards/[id]/route.ts` | Add | `GET` detail (masked, 404), `PATCH` status (400/404/409) |
| `src/app/api/cards/route.test.ts`, `src/app/api/cards/[id]/route.test.ts` | Add | Handler-level tests: every rejection, the one-time number, masking on list/detail, 409 on cancelled |
| `src/app/cards/page.tsx` | Add | `/cards` list with written empty state |
| `src/app/cards/issue-card-dialog.tsx` | Add | Drawer form, inline errors, success screen with the number shown once |
| `src/app/cards/card-row-actions.tsx` | Add | Freeze / unfreeze / cancel with confirm, pending and error states |
| `src/app/cards/[id]/page.tsx` | Add | Detail: record, `SpendProgress`, event timeline, `notFound()` |
| `src/components/ui/cards/SpendProgress.tsx` | Add | Progressbar with amber past 80% |
| `src/components/ui/payments/StatusBadge.tsx` | Change | Add `active`, `frozen`, `cancelled` |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | Change | Cards in nav and crumbs |
| `src/data/queries.ts`, `src/data/queries.test.ts` (new), `src/data/metrics.ts`, `src/data/metrics.test.ts` (new) | Change | The three pre-existing defects above, each pinned by a test |
| `package.json`, `package-lock.json`, `vitest.config.mts` | Change | Make `npm test` start on Node 18 |

## Plan

1. **Baseline** — branch `NWP-201-issue-cards` from `main`; fix the vitest startup; `npm test` green on Node 18. *Done when: 28 passing.*
2. **Types + pure card module + tests** — `src/lib/cards.ts` and `src/lib/cards.test.ts`. *Done when: `npx vitest run src/lib/cards.test.ts` passes: every generated number starts `4242`, is 16 digits, passes Luhn; hand-built numbers with a wrong check digit fail; all nine transition pairs answer correctly; each validation rule has a rejecting case and the happy path passes.*
3. **Store module + seed + tests** — `src/data/cards.ts`, `generate.ts`, `store.ts`. *Done when: `issueCard` returns a record without a `number` field, `store.cards` contains only `last4` + `numberRef`, `transitionCard` refuses `cancelled → active`, and the existing suites still pass (seed payments unchanged).*
4. **Routes + handler tests** — `POST/GET /api/cards`, `GET/PATCH /api/cards/[id]`. *Done when: tests cover 400 for each rule, 201 with `number` exactly once, list and detail bodies with no `number`, 404 for an unknown id, 409 for a terminal transition; `curl` against the dev server agrees.*
5. **Stop and read the diff** — money in minor units, validation on the server, no second helper, no PAN in any fixture.
6. **List page + nav** — `/cards`, sidebar, breadcrumbs, `StatusBadge`. *Done when: `/cards` renders the seeded cards with masked numbers; the empty state renders when the store has none.*
7. **Issue dialog** — form, validation errors, success screen. *Done when: submitting creates a card that appears in the list; the number shows once; reopening the drawer shows an empty form.*
8. **Row actions + detail page** — freeze/unfreeze/cancel, `SpendProgress`, timeline. *Done when: freezing updates the badge without a reload; cancelled rows have no actions; the bar is amber on a card past 80%.*
9. **Pre-existing bug fixes** with tests. *Done when: `queries.test.ts` and `metrics.test.ts` pass.*
10. **Ship** — `org-standards` on the diff, `/ship-ready`, `npm test`, `npm run build`, `/pr`, commit, `/submit`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card from a form; it appears in the list | Route test: `POST /api/cards` → 201 and the next `GET` lists it. Browser: fill the drawer, submit, close, see the row |
| `/cards` shows nickname, merchant, masked number, limit, status, created date | Browser check of the seeded rows; route test asserts list bodies carry `last4` and never `number` |
| Detail shows the full record and spend against the limit | Browser: open a seeded card; `SpendProgress` shows `spent / limit` as `formatMoney` strings and a percentage |
| Numbers generated server-side on `4242` with a valid Luhn digit | `cards.test.ts`: 200 generated numbers all start `4242`, are 16 digits, pass `isLuhnValid`; a flipped digit fails |
| Reveal once, mask forever | Route tests: `number` present in the 201 body only; absent from list, detail, and PATCH bodies; `cards.test.ts` on `maskCardNumber`. Browser: success screen shows it; list and detail show `•••• 1234` |
| Server-side validation of merchant, limit range, currency | Route tests for missing merchant, unknown merchant, `0`, `-1`, `5000001`, `250.5`, `"25000"`, `"CHF"`; `curl` reproduces the 400 bodies |
| Stretch: freeze/unfreeze without reload | Browser: click Freeze, badge flips, no navigation; route test for `PATCH` 200 and 409 |
| Stretch: spend progress amber past 80% | Seeded card above 80% renders the amber class; a `SpendProgress` percentage helper is unit tested |
| Stretch: category lock | Allowlist in `cards.ts`, test on rejection of an unknown category, shown on list and detail |
| Stretch: tests beside the code | The five test files above; `npm test` summary in the PR |
| Stretch: empty and error states | Empty `/cards` copy; inline `role="alert"` error in the dialog and on a failed row action |

## Risks

- **`router.refresh()` latency could read as "did it work?"** The row button shows `isLoading` until the refresh resolves, and a failure shows an inline message rather than silently reverting.
- **Seeding cards via the shared PRNG could alter payment data.** Cards are generated after payouts, and `csv.test.ts`/`money.test.ts` do not depend on generated data; a hash of the first payment id and amount is checked manually before and after.
- **A card number in a test fixture.** Tests only ever assert on generator output or on numbers that start `4242`; nothing else that is 16 digits appears in the repo.
- **Scope creep from the bug sweep.** Only three mechanical fixes are taken; the rest are listed in the PR for a separate ticket.

## Out of scope

- Persistence (NWP-203), editing a limit after issue (NWP-202), auth, real issuer calls.
- Cross-currency totals and the refund series on the overview, the exclusive week bound in `analytics.ts`, and `from`/`to` validation in `parseFilters`. Reported in the PR notes.
- Editing the pre-push hook: the permission classifier blocks edits to `.claude/hooks/`, so the Node 18 problem is fixed on the project side instead.

## Open questions

- Should a frozen card still count spend? Built so `spent` is a stored figure that does not change on freeze; nothing in this ticket moves spend.
- Should the merchant category lock be required? Built as optional (`none` is a valid choice) because the ticket calls it a lock, not a field every card must have.
