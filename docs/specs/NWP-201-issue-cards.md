# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Leon
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants issuing, listing, and inspecting a card to happen in the console.

## Current state

Cards do not exist in this codebase as a domain object. Almost every file below is new, which is unusual for this repo and worth knowing before estimating.

- `src/data/types.ts` — no `Card` type and no `CardStatus`. `cardBrand` and `last4` (lines 32–33) are attributes of a `Payment`, unrelated to issuing.
- `src/data/store.ts:16` — the `Store` interface holds merchants, payments, refunds, disputes, payouts. **No `cards` array.** Line 34 pins the store to `globalThis.__northwindStore`, so writes survive dev-server module reloads; new cards go here and vanish on restart, which is expected.
- `src/app/api/` — only `payments/route.ts` and `payments/export/route.ts` exist. There is no cards route.
- **There is no Luhn implementation anywhere.** `grep -rn -i luhn src/` returns nothing. It has to be written.
- `src/data/generate.ts:101` — seed payments get `last4: String(between(1000, 9999))`. No full card number is generated anywhere today, so the reveal-once path has no precedent to copy.
- `src/data/generate.ts:21` — `mulberry32`, `pick` and `between` are module-private; only `generate` and `GENERATED_AT` are exported. Card generation cannot reuse them without widening that file's API.
- `src/data/generate.ts:55` — id convention is `pay_000001`, `re_000001`, `dp_000001`, `po_0001` via `pad(n, width)`. Cards should follow it.
- `src/lib/money.ts:46` — **`parseAmountToMinorUnits` already exists** and is documented "Boundary only". It is exactly the spend-limit parser the issue form needs; writing a second one costs points.
- `src/app/payments/[id]/page.tsx` — the detail-page pattern to copy: async server component, `params: Promise<{ id: string }>`, `notFound()` on a miss, a local `Field` helper (line 127), `Divider`, `formatMoney`, and `formatInZone` against the merchant's timezone.
- `src/app/payments/export-dialog.tsx` — the dialog pattern to copy: `"use client"`, `Drawer` from `@/components/Drawer`, native inputs with labels. There is no `Dialog.tsx` despite what `.claude/rules/components.md` claims.
- `src/components/ui/payments/StatusBadge.tsx:5` — `AnyStatus` is a union of `PaymentStatus | DisputeStatus | PayoutStatus` with three exhaustive `Record` maps (lines 7, 22, 37). Adding `CardStatus` means extending the union and all three maps; `active`, `frozen` and `cancelled` collide with no existing key, and TypeScript will fail the build if a map is left incomplete.
- `src/app/siteConfig.ts:5` — `baseLinks` has overview, payments, disputes, payouts. `src/components/ui/navigation/AppSidebar.tsx:26` holds the four-entry `navigation` array; `CreditCard` from lucide-react is already taken by Payments, so Cards needs a different icon.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`. Never a float" | NWP-201, rule 1 | Limits drift; the 5,000,000 check becomes meaningless |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md` | The one rule whose breach is a real incident, not a bug |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, **including in tests and fixtures**" | `.claude/rules/cards.md` | A fixture that looks like a PAN fails the rule even if the app is correct |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Client-generated numbers |
| `active ⇄ frozen`, either to `cancelled`, `cancelled` terminal — "Guard the transition on the server, not only in the UI" | `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Anything from the client … is checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md` | The ticket's sixth core criterion |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone." | `merchant-console/CLAUDE.md` | Created dates shift |
| No database, no ORM, no migrations | NWP-201 out of scope, NWP-203 | Costs the clock and earns nothing |

## Approach

Bottom up, because the number generator is the part that must be right and it is the cheapest to test. A new `src/lib/cards.ts` owns the `4242`-prefixed generator, the Luhn check digit, and the status-transition guard, with tests beside it. `Card` and `CardStatus` join `src/data/types.ts`, and `store.cards` joins the existing in-memory store. `src/data/cards.ts` holds the query helpers (`cardById`, `listCards`) so route handlers never touch `store` directly, mirroring how `src/data/queries.ts` sits in front of payments. `POST /api/cards` validates nickname, merchant, limit and currency against allowlists, generates the number server-side, stores only the last four plus a reference, and returns the full number exactly once in that response. `GET /api/cards` and `GET /api/cards/[id]` never include it. The UI is a `/cards` list with an issue dialog built on `Drawer`, a success view that shows the number once and holds it in no state that outlives the dialog, and a `/cards/[id]` detail page copying the payments detail layout.

**Considered and rejected:** deriving spend from payments by linking cards to `store.payments`. It would make the spend bar "real", but nothing in the seed data connects a payment to an issued card, so it means inventing that relationship and backfilling it — hours of work for a progress bar, inside a 45-minute ticket whose core criteria do not ask for it. A stored `spent` counter carries the same display and costs nothing. See Open questions.

**Also rejected:** generating the number in the issue dialog to show it immediately. Explicitly a bug per `.claude/rules/cards.md`.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/cards.ts` | add | `4242` generator, Luhn check digit, status-transition guard |
| `src/lib/cards.test.ts` | add | Luhn validity, `4242` prefix, transition matrix — the ticket's named test target |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory` (stretch) |
| `src/data/store.ts` | change | `cards: Card[]` on the `Store` interface and `createStore` |
| `src/data/cards.ts` | add | `cardById`, `listCards`, `issueCard` — nothing else reads `store.cards` |
| `src/app/api/cards/route.ts` | add | `POST` issues and reveals once; `GET` lists masked |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail masked; `PATCH` status transition (stretch) |
| `src/app/cards/page.tsx` | add | The list, with a written empty state |
| `src/app/cards/[id]/page.tsx` | add | Detail and spend against limit |
| `src/app/cards/issue-dialog.tsx` | add | Client component: form, submit, reveal-once success view |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend `AnyStatus` and its three maps with the card statuses |
| `src/app/siteConfig.ts` | change | `baseLinks.cards` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Nav entry, icon other than `CreditCard` |

## Plan

Core first. Each step ends somewhere checkable.

1. **`src/lib/cards.ts` + tests** — done when: `npm test` shows generated numbers starting `4242`, passing an independent Luhn check, and every legal and illegal transition asserted. No fixture in the test file resembles a PAN.
2. **Type, store, and `src/data/cards.ts`** — done when: `npx tsc --noEmit` is clean and `issueCard` appends to `store.cards`.
3. **`POST` / `GET /api/cards` with validation** — done when: `curl` proves a card is created and the full number appears in that response; a second `GET` returns the same card with `last4` only and no `number` field; and missing merchant, `0`, `-1`, `5000001`, and `currency=JPY` each return `400`.
4. **`/cards` list + issue dialog + reveal-once success** — done when: issuing from the dialog shows the number once, the card appears in the list masked, and reopening the dialog or reloading never shows that number again.
5. **`/cards/[id]` detail** — done when: the record renders with spend against limit, and an unknown id renders `notFound()`.
6. **Nav, `StatusBadge`, empty and error states** — done when: Cards is in the sidebar, badges render for all three statuses, and `/cards` with an empty store shows written copy rather than a bare table.
7. **Stretch, in this order** — freeze/unfreeze via `PATCH` without a full reload; spend bar amber past 80%; category lock.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card from a form, appears in list | Submit the dialog, see the row; `GET /api/cards` includes it |
| `/cards` list: nickname, merchant, masked number, limit, status, created | Load `/cards` and read the row against the store |
| Card detail shows full record and spend against limit | Open `/cards/<id>`; unknown id → 404 |
| Numbers generated server-side, `4242` BIN, valid Luhn | Unit test in `src/lib/cards.test.ts`; no generator imported into a client component |
| Reveal once, mask forever | Full number present in the `POST` body, absent from `GET` list and detail bodies, and absent from the DOM after the success view closes |
| Server-side validation | `curl` the five rejection cases in plan step 3; each `400` |
| Status transitions guarded server-side (stretch) | `PATCH` `cancelled → active` returns `400` even though the UI hides the control |

## Risks

- **Reveal-once is the criterion most likely to be quietly failed.** The number can leak by being written onto the `Card` record, returned by a `GET`, or left in React state after the dialog closes. Check the response bodies and the DOM, not just the screen.
- **The 5,000,000 boundary is inclusive.** The ticket rejects "above 5,000,000", so `5000000` must be accepted and `5000001` rejected. Easy to get backwards.
- **`StatusBadge` has three exhaustive `Record` maps.** Extending the union without extending all three fails the build — a fast failure, but a surprising one mid-clock.
- **45 minutes and thirteen files.** If time runs short, stop after plan step 5 and say so in the PR rather than half-landing stretch goals.

## Out of scope

- Persistence of any kind. No database, no ORM, no migrations — NWP-203.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a card's limit after issue — NWP-202.

## Decisions taken

Both open questions were answered before building.

1. **Spend is a stored counter.** `Card.spent`, integer minor units, `0` on issue. Nothing links seed payments to issued cards and inventing that relationship is a larger ticket. **Consequence to know:** nothing ever increments it, so a card issued through the UI sits at 0 forever and the spend bar only moves for seeded cards.
2. **The store seeds four cards.** `SEED_CARDS` in `src/data/generate.ts`, explicit rather than rolled, at 12%, 47%, 88% and 64% of their limits with one frozen. The 88% card is the amber case. Currencies land on USD, GBP and EUR through their merchants. They are generated *after* the payment loop so no payment PRNG draw shifts.

## Where the build departed from this plan

- **Two extra files.** `src/app/cards/status-actions.tsx`: the file map folded freeze/unfreeze into the list page, but it needs client state for the in-flight and error cases and the list page is a server component. `src/data/cards.test.ts`: `parseCardInput` is the whole server-side allowlist and had only end-to-end `curl` proof, so it got 13 unit tests of its own.
- **Card vocabulary moved to `src/lib/cards.ts`.** `CARD_CATEGORIES` and `CARD_CATEGORY_LABELS` sit beside `CARD_STATUSES` rather than in `src/data/cards.ts`, so the dialog and the card detail read one label map and cannot drift apart. `src/data/cards.ts` keeps the store access and the request validation.
- **The spend bar snaps to 5% steps.** Tailwind cannot build a class from a runtime value and `.claude/rules/components.md` bars inline styles, so `src/app/cards/[id]/page.tsx` indexes a lookup of literal width classes. The exact percentage sits in the label beside it.
- **All five stretch goals landed**, including the category lock, which is chosen at issue time, validated against an allowlist, and shown on the card detail.
- **The empty state was verified** by temporarily returning no seed cards, loading `/cards`, and reverting. It renders "No cards issued yet" with its own copy.

## Open questions

- None outstanding.
