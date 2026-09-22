# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Rajesh Susai
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It happens twelve to twenty times a week, it takes hours, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants issuing, listing, and inspecting a card to be something ops does in the console instead of something it asks for.

## Current state

The console has payments, disputes, and payouts. Cards do not exist in any layer — no type, no store slice, no route, no page.

- `src/data/types.ts` — `Currency`, `Merchant`, `Payment`, and the other records. No `Card`, no card status.
- `src/data/store.ts:16` — the in-memory `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. Held on `globalThis` so dev-server module reloading does not hand each request a fresh copy. Adding a slice means adding a field here.
- `src/data/queries.ts:45` — `filterPayments` is *the* payment query builder, with `paymentById` at `:108` as the single-record accessor pattern. This builder is payment-shaped (status/merchant/search/date/page); it is not a generic filter, so cards get their own small accessors modelled on `paymentById` rather than a second filter path through it.
- `src/data/merchants.ts` — ten fictional merchants, `mch_01`–`mch_10`, each with a `currency` and an IANA `timezone`. `merchantById` at `:90` is the existence check a card's `merchantId` must pass.
- `src/lib/money.ts` — `formatMoney` (`:15`), `parseAmountToMinorUnits` (`:46`, already documented "Boundary only"), `sumMinorUnits`. **A second formatter or parser is a defect.**
- `src/lib/dates.ts` — `formatDate` (`:31`, UTC, for tables) and `formatInZone` (`:22`, merchant timezone, for detail pages).
- `src/app/api/payments/route.ts` and `.../export/route.ts` — the only two route handlers. Neither can fail, so **the repository has no established API error shape**. This spec establishes one.
- `src/app/payments/page.tsx` — the list pattern: async server component, reads the store directly, `TableRoot`/`Table`, a written empty state at `:93`, and masked card display as `•••• {last4}` at `:123`.
- `src/app/payments/[id]/page.tsx` — the detail pattern: `notFound()` on a miss, a `dl` of `Field` components, UTC and merchant-timezone timestamps side by side at `:71`.
- `src/components/Drawer.tsx` — a Radix Dialog wrapper exporting `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerBody`, `DrawerFooter`, `DrawerClose`. The issue form needs no new dependency.
- `src/components/ui/payments/StatusBadge.tsx` — one badge over a `PaymentStatus | DisputeStatus | PayoutStatus` union with three lookup maps. Card statuses do not collide with any existing member, so this extends rather than being duplicated.
- `vitest.config.ts` — `environment: "node"`, `include: ["src/**/*.test.ts"]`. Tests are plain Node with no DOM, so the Luhn generator and the status machine are testable and React components are not.
- `src/components/Sidebar.tsx` + `src/components/ui/navigation/AppSidebar.tsx:26` — nav is a literal array built from `src/app/siteConfig.ts:5`. A new route needs an entry in both.

**Where the ticket and the code disagree:** the ticket writes the mask as `•••• 4242`, but `4242` is the BIN — the first four digits — while the same ticket says to store *the last four*. For a 16-digit number beginning `4242`, those are different. `src/app/payments/page.tsx:123` already renders `•••• {last4}`. We follow the codebase and mask on the stored last four; `•••• 4242` in the ticket is read as illustrating the format, not a literal string.

**Also found, not fixed:** `sortPayments` at `src/data/queries.ts:81` sorts amounts with `String(a.amount).localeCompare(...)`, so `900` orders above `10000`. Real defect, unrelated to this ticket, left alone to keep the diff honest.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | A limit stored as `250.00` compares and accumulates wrong; cents drift on every total |
| "Never parse a currency string into a number... it is validated and converted at the boundary, once" | `.claude/rules/money.md` | Two parsers disagree and the form accepts what the store rejects |
| "Format at the edge, in the component that renders it" | `.claude/rules/money.md` | A formatted string gets stored and becomes uncomparable |
| "Every generated number starts `4242` and carries a valid Luhn check digit" | `.claude/rules/cards.md` | Something in the repository resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | The number is guessable and the client is trusted with issuance |
| "Reveal once... not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md` | A full PAN is re-readable, which is the one thing this feature must never allow |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life through a hand-made request |
| "Validate on the server... checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md` | The client is the enforcement, and it is not trusted |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside `USD`, `EUR`, `GBP`" | `docs/tickets/NWP-201.md` | The exact cases the grader checks |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone." | `merchant-console/CLAUDE.md` | `createdAt` is ambiguous and dates shift under the reader |
| "Use what is here... Button, Input, Select, Dialog, Badge" / "Dialogs and forms must be operable" | `.claude/rules/components.md` | A hand-rolled dialog that traps focus and ignores Escape |
| "Do not add a database, an ORM, or a migration" | `docs/tickets/NWP-201.md` | Time spent on NWP-203, scoring zero |

## Approach

Cards get a thin vertical slice that mirrors how payments already work, built server-side first. A `Card` record joins `src/data/types.ts` and a `cards` slice joins the store, seeded like `merchants.ts` so the list and the spend bar have something to show on a cold boot. All the logic worth testing goes in one pure module, `src/lib/cards.ts` — Luhn arithmetic, test-BIN generation, masking, and the transition table — so it is covered by `npm test` under the existing Node environment before any component exists. `src/data/cards.ts` holds the store accessors and one `validateIssueCardInput` function that is the single allowlist gate; the route handlers call it and never read the body themselves, the way `src/app/api/payments/route.ts:5` delegates to `parseFilters`. Three routes: `POST /api/cards` returns the created card plus the full number as the one and only reveal, `GET /api/cards` returns masked records, `PATCH /api/cards/[id]` moves status through the guarded machine. The UI then reads the store directly in server components for the list and detail, exactly as the payments pages do, and the one client component is the issue drawer plus the row actions that `PATCH` and call `router.refresh()`.

**Considered and rejected:** routing card filtering through the existing payment query builder in `src/data/queries.ts`. `CLAUDE.md` says "One query builder" and a second implementation is a bug — but that rule is about *payment filtering*, and the builder's shape is payment-specific (`payment.status`, `payment.last4`, `payment.description`). Forcing cards through it would mean either generic-ing it or passing cards into a function that reads payment fields. Cards need no filtering at all for this ticket, so they get `listCards`/`cardById` accessors modelled on `paymentById`, and the payment builder is left untouched.

**Also rejected:** storing spend as a derived sum over payments. There is no card→payment link in the seed data and inventing one is a bigger change than the ticket asks for; `spend` is a field on the card in minor units, `0` at issue.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `MerchantCategory`, `Card`. Amounts documented as minor units, `createdAt` as UTC, alongside the existing records |
| `src/data/cards.ts` | add | Seed cards, `listCards`, `cardById`, `createCard`, `setCardStatus`, `validateIssueCardInput`, the currency and category allowlists |
| `src/data/store.ts` | change | `cards` joins the `Store` interface and `createStore` |
| `src/lib/cards.ts` | add | Pure card logic: `TEST_BIN`, `luhnCheckDigit`, `isValidLuhn`, `generateCardNumber`, `maskLast4`, `CARD_TRANSITIONS`, `canTransition`, `MAX_SPEND_LIMIT_MINOR_UNITS` |
| `src/lib/cards.test.ts` | add | Luhn and transition coverage, beside the code it covers, per the ticket's stretch goal |
| `src/app/api/cards/route.ts` | add | `POST` issues and reveals once; `GET` lists masked |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` status through the guarded machine; `GET` one masked card |
| `src/app/cards/page.tsx` | add | The `/cards` list: nickname, merchant, masked number, limit, status, created. Written empty state |
| `src/app/cards/issue-card-drawer.tsx` | add | Client. The labelled form on `Drawer`, server-side field errors, and the one-time reveal screen |
| `src/app/cards/card-actions.tsx` | add | Client. Freeze / unfreeze / cancel via `PATCH` + `router.refresh()`, no full reload |
| `src/app/cards/[id]/page.tsx` | add | Card detail: full record, spend against limit |
| `src/components/ui/cards/SpendProgress.tsx` | add | The bar. Amber past 80%, with `role="progressbar"` |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend the union and the three maps with `active`, `frozen`, `cancelled` rather than adding a second badge |
| `src/app/siteConfig.ts` | change | `baseLinks.cards` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | A Cards nav entry, so the route is reachable |

## Plan

Sequenced so each step ends somewhere verifiable.

1. **Types, seed, store slice** — done when: `npx tsc --noEmit` passes and the store exposes `cards` with seeded records, one of them deliberately past 80% spend.
2. **`src/lib/cards.ts` and its tests** — done when: `npm test` is green, including a thousand generated numbers that all begin `4242` and satisfy Luhn, every legal and illegal transition pair asserted, `cancelled` proven terminal, and the limit boundaries at `0`, `-1`, `5000000`, `5000001`.
3. **Accessors and validation in `src/data/cards.ts`** — done when: `validateIssueCardInput` rejects each of the ticket's four cases with a field-level message and accepts a valid payload, exercised through step 4's curls.
4. **The three routes** — done when: `curl` issues a card and gets a full number once; `GET /api/cards` contains no full number for that card; a missing merchant, a `0` limit, a `5000001` limit and a `JPY` currency each return `400`; `PATCH` to `frozen` then `active` returns `200`; `PATCH` from `cancelled` to `active` returns `409`; an unknown id returns `404`.
5. **Read the diff.** Minor units in every stored amount, validation on the server and not only the form, no second formatter or parser, no full number on the record.
6. **List page and issue drawer** — done when: submitting the form creates a card, the reveal screen shows the full number once, closing it returns to a list where that card reads `•••• {last4}`, and a reload never shows the full number again.
7. **Detail page and spend progress** — done when: opening a card shows its record with UTC and merchant-local created timestamps, and the bar is amber on the seeded card past 80%.
8. **Row actions, nav, empty and error states** — done when: freeze and unfreeze change the badge without a full page reload, cancel is terminal in the UI as well as the server, `/cards` is reachable from the sidebar, and both an empty list and a failed request put something written on screen.
9. **Ship** — `npm test`, `/ship-ready`, `/pr`, commits prefixed `NWP-201:`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Fill the drawer in the browser; the card appears in `/cards` without a manual reload. Screenshot |
| Card list at `/cards` | The table renders all six required columns for seeded and newly issued cards. Screenshot |
| Card detail | `/cards/<id>` shows the full record and spend against limit; an unknown id renders `notFound()` |
| Generated numbers, server-side, `4242` BIN, valid Luhn | `src/lib/cards.test.ts` over a thousand generations; `generateCardNumber` is imported only by the route handler, verified by `grep` |
| Reveal once, mask forever | `POST /api/cards` response contains `fullNumber`; `GET /api/cards` and `GET /api/cards/<id>` do not, checked by `curl`; a test asserts the stored record has no full-number field |
| Server-side validation | Four `curl` calls — missing merchant, `0` limit, `5000001` limit, `JPY` — each `400` with a field message; unit tests on the same boundaries |
| Freeze / unfreeze (stretch) | Click freeze in the list, badge changes with no full reload; `PATCH` from `cancelled` returns `409` by `curl` |
| Spend progress amber past 80% (stretch) | The seeded over-80% card renders the amber bar. Screenshot |
| Category lock (stretch) | Chosen in the drawer, stored, shown on detail; a category outside the allowlist returns `400` |
| Tests (stretch) | `npm test` passing, output pasted in the PR |
| Empty and error states (stretch) | `/cards` with an emptied store shows written copy; a forced failing `PATCH` shows a written error |

## Risks

- **The masking ambiguity.** If the grader reads `•••• 4242` literally, masking on last four reads as a miss. Mitigation: one `maskLast4` helper, so the decision is in a single line, and the reasoning is recorded above and in the PR.
- **`globalThis` store and dev-server reloading.** `src/data/store.ts:36` only pins the store outside production; writes could appear to vanish mid-session if that path changes. Mitigation: touch neither the pinning nor the seed, and verify a created card survives a client-side navigation.
- **Clock.** Nine steps in 45 minutes. Steps 1–5 are the 60% of the score that is core criteria plus correctness rules, so the UI gets cut before they do, and step 2's tests land early because they are also the first tie-break.
- **Scope creep into NWP-202/203.** Editing a limit and persistence both look one small change away from card detail. Neither gets built.

## Out of scope

- **Persistence** — no database, ORM, or migration. The store is in memory on purpose; that is NWP-203.
- **Editing a spend limit after issue** — NWP-202.
- Authentication, roles, and permissions.
- Real card network calls. There is no issuer.
- **Fixing `sortPayments`** at `src/data/queries.ts:81`, which is a genuine bug but belongs to payments, not to this ticket.

## Open questions

- Does spend ever need to reconcile against real payments, or does a card carry its own counter until an issuing ledger exists? Built as a counter; the answer changes NWP-203's shape more than this ticket's.
- Is the category lock advisory metadata, or should it eventually reject an authorization? Stored and displayed only, since there is no authorization path here to enforce it against.
