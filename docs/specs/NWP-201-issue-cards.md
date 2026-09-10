# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Shan Kwan Cho
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants it in the console: issue a card, see the cards you have issued, open one to check it.

## Current state

The merchant console has **no card code whatsoever**. There is no `src/app/cards/`, no `src/app/api/cards/`, no card entity, no Luhn helper. Every part of this ticket is new code inside an existing set of conventions.

- `build-battle/merchant-console/src/data/store.ts` — the in-memory store. Built once at boot, held on `globalThis` so the dev server's module reloading does not hand every request a fresh copy. A new entity is a field on `interface Store` plus a line in `createStore()`.
- `build-battle/merchant-console/src/data/generate.ts` — where seed data actually comes from. **The app's `CLAUDE.md` says "Seed data is JSON, loaded into a store module at boot"; that is not true of this codebase.** Seed rows are produced by a deterministic PRNG in TypeScript, with ids from a local `pad()` helper (`pay_000001`, `dp_000001`). `GENERATED_AT` is the fixed clock the seeded pages read instead of `new Date()`.
- `build-battle/merchant-console/src/data/merchants.ts` — the shape a small entity module takes here: a typed array plus a `merchantById` lookup beside it. The ten merchants are the only valid `merchantId` values.
- `build-battle/merchant-console/src/data/types.ts` — every entity interface, with `Currency = "USD" | "EUR" | "GBP"` already defined and `Payment.amount` documented as "Integer minor units. Never a float."
- `build-battle/merchant-console/src/data/queries.ts` — the query builder. `parseFilters` is the allowlist-parser convention: it never throws and always returns a safe object. `paymentById` returns `T | null`.
- `build-battle/merchant-console/src/lib/money.ts` — `formatMoney`, `formatMoneyCompact`, `sumMinorUnits`, and `parseAmountToMinorUnits`. The last one converts `"250.00"` to `25000` at a boundary and returns `null` on anything else; note it accepts `"0"`, so a positive-limit check is still ours to write.
- `build-battle/merchant-console/src/lib/dates.ts` — `formatDate(iso)` for tables (UTC) and `formatInZone(iso, tz)` for detail pages (merchant timezone).
- `build-battle/merchant-console/src/app/api/payments/route.ts` — the route-handler convention: a thin non-async `export function GET(request: NextRequest)` that delegates every decision to `@/data/queries`. **There is no POST anywhere in this app, no error body shape, and no non-200 response.** This ticket defines those.
- `build-battle/merchant-console/src/components/ui/payments/StatusBadge.tsx` — status rendering is centralised in three parallel `Record<AnyStatus, …>` maps. A new status union must be added to all three or TypeScript fails the build.
- `build-battle/merchant-console/src/app/payments/page.tsx` and `.../payments/[id]/page.tsx` — the list and detail patterns to copy, including the written empty state and the masking string `•••• {last4}`, which is hand-inlined in both files and has never been extracted.
- `build-battle/merchant-console/src/app/payments/filter-bar.tsx` — the client-component pattern: `"use client"`, `useRouter`, local `useState`.
- `build-battle/merchant-console/src/components/` — the primitives. **There is no `Dialog` component and no `Label` component, despite `.claude/rules/components.md` naming a Dialog.** The modal primitive is `Drawer.tsx`, built on Radix Dialog, with `DrawerTitle`/`DrawerDescription` for its accessible name.
- `build-battle/merchant-console/vitest.config.ts` — node environment, `include: ["src/**/*.test.ts"]`. A `.test.tsx` file is silently never collected. Tests live beside the code they cover (`src/lib/money.test.ts`).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; `$250.00` is `25000` | `CLAUDE.md`, `rules/money.md`, ORG-STANDARDS #1 | Cents drift on every total, and a stored float is a violation even when the number looks right |
| "Format at the edge, in the component that renders it, and nowhere else" | `rules/money.md`, ORG-STANDARDS #2 | A formatter's output re-enters arithmetic or storage |
| "Validate everything from the client against an allowlist before it reaches the store" | `rules/api-routes.md`, ORG-STANDARDS #7 | The client is trusted, which the ticket says explicitly it is not |
| "Every generated number starts `4242` and carries a valid Luhn check digit" | `rules/cards.md` | Something in this repository resembles a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `rules/cards.md` | The PAN exists somewhere it can be read |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `rules/cards.md`, ORG-STANDARDS #8 | A stored or re-readable PAN — the most serious defect available on this ticket |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `rules/cards.md` | A cancelled card comes back to life through a crafted request |
| "Match the neighborhood" / "No debris" | ORG-STANDARDS #9, #10 | A second money formatter, a second query path, a stray `console.log` |

## Approach

Add a card module that mirrors the merchant and payment modules rather than inventing a layer for it. Types go beside the existing entities in `src/data/types.ts`; the deterministic seed goes in `src/data/generate.ts` next to the payment seed; the store gains a `cards` array; and one access module, `src/data/cards.ts`, owns every card read and write. Pure card mechanics — Luhn, masking, the transition table — go in `src/lib/cards.ts` beside `money.ts` and `dates.ts`, with a `.test.ts` next to it, which is exactly what the three existing `src/lib` helpers do.

Validation and status transitions return a discriminated result (`{ ok: true, value } | { ok: false, error, status }`) from `src/data/cards.ts`. That keeps route handlers as thin as `api/payments/route.ts` and, more usefully, makes every validation boundary unit-testable in Vitest's node environment without standing up HTTP.

The full number exists in exactly one variable, inside `issueCard`, long enough to derive `last4` and an opaque `reference`. It is returned in the POST response and never assigned to the stored record. Masking is therefore a property of the `Card` type rather than a filter a future route can forget to apply.

**Considered and rejected:** deriving card spend by joining `store.payments`. Payments carry no card reference, so it would mean inventing a link and back-filling seed payments — a larger, more invasive diff than a `spent` integer field on the card, and it drifts toward the persistence work the ticket puts out of scope. Also rejected: a `Dialog`-based form (no such component exists here) and any second money formatter (`rules/money.md` calls that out by name).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, `Card`, `CardEvent`, reusing the existing `Currency` |
| `src/lib/cards.ts` | add | `generateCardNumber`, `isLuhnValid`, `luhnCheckDigit`, `maskLast4`, `canTransition` — pure, no store import |
| `src/lib/cards.test.ts` | add | Luhn validity across many draws, the `4242` BIN, tampered-digit rejection, masking, every legal and illegal transition |
| `src/data/generate.ts` | change | Seed cards from the existing PRNG and `pad()` id convention |
| `src/data/store.ts` | change | `cards: Card[]` on `interface Store` and in `createStore()` |
| `src/data/cards.ts` | add | The single card access module: `listCards`, `cardById`, `validateIssueInput`, `issueCard`, `setCardStatus` |
| `src/data/cards.test.ts` | add | Validation boundaries, transition guarding through the store, and that no stored or returned record carries a full number |
| `src/app/api/cards/route.ts` | add | `GET` list (masked) and `POST` create (the one reveal) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail (masked) and `PATCH` status, `409` on an illegal transition |
| `src/app/cards/page.tsx` | add | `/cards`: nickname, merchant, masked number, spend limit, status, created date, written empty state |
| `src/app/cards/issue-card-form.tsx` | add | Client. Drawer form with labelled inputs, submitting state, server-error surface, one-time reveal |
| `src/app/cards/card-actions.tsx` | add | Client. Freeze, unfreeze, cancel without a page reload |
| `src/app/cards/[id]/page.tsx` | add | Detail: full non-sensitive record, spend against limit, status history |
| `src/components/ui/payments/StatusBadge.tsx` | change | Card statuses added to `AnyStatus` and the three `Record` maps |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | The `/cards` nav entry |

## Plan

1. **Card mechanics** — `src/lib/cards.ts` and its test. *Done when:* `npm test` proves generated numbers are sixteen digits, start `4242`, pass Luhn, and that every illegal transition is refused.
2. **Types, seed, store** — *Done when:* `npx tsc --noEmit` is clean and the store exposes seeded cards.
3. **Access module** — `src/data/cards.ts` and its test. *Done when:* boundary tests pass and a test asserts no returned record carries a full number.
4. **API routes** — *Done when:* `curl` shows `201` with the full number on create, list and detail with `last4` only, `400` on each invalid input, and `409` on `cancelled → active`.
5. **Review the server diff** — minor units, accidental retention of a full number, validation coverage, duplicated helpers. *Done when:* the diff is clean on all four.
6. **List and issue form** — *Done when:* issuing in the browser adds a row and shows the number once, and reopening the card never shows it again.
7. **Detail** — full record, spend against limit, status history. *Done when:* a seeded card over 80% renders amber.
8. **Stretch** — freeze/unfreeze without reload, spend progress, category lock, written empty and error states.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill the drawer, submit, the row appears in `/cards` without a reload |
| Card list at `/cards` | Browser: nickname, merchant, `•••• 4242`, spend limit, status, created date |
| Card detail | Browser: open a card, full record and spend against the limit |
| Generated card numbers | `npm test` — `src/lib/cards.test.ts` asserts the BIN, the length, and Luhn over many generated numbers |
| Reveal once, mask forever | `curl` POST shows the number; `curl` GET list and detail show only `last4`; in the browser, dismiss and reopen — the number is gone |
| Server-side validation | `curl` each rejection: missing merchant, `0`, `-1`, `5000001`, a non-integer, `JPY` → `400` with a readable message; unit tests cover the same boundaries |
| Status state machine | `npm test` on `canTransition`; `curl` PATCH `cancelled → active` → `409` |
| Freeze/unfreeze without reload | Browser: click Freeze, the badge changes, no navigation |
| Spend progress amber past 80% | Browser, on a seeded high-spend card |

## Risks

- **The clock.** Forty-five minutes against a fifteen-file diff. Mitigated by verifying and submitting the core first, then pushing stretch work additively — the grader re-scores every push.
- **A full number leaking into a payload by accident.** Mitigated by never putting the field on the `Card` type at all, plus a test that asserts it.
- **Vitest silently skips `.tsx` tests.** All tests go in `.ts` files.
- **`params` and `searchParams` are Promises in Next 15** and must be awaited in the new pages.

## Out of scope

- Persistence, a database, an ORM, migrations — NWP-203.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a card's limit after issue — NWP-202.
- Authorising spend against a card. Seeded cards carry a `spent` figure so the progress bar has something real to draw; nothing in this ticket increments it.

## Open questions

- The ticket names a **merchant category lock** but does not say what it locks. Built as chosen-at-issue, validated against an allowlist, and shown on the card; no enforcement engine, because there are no card transactions here to enforce against.
- Newly issued cards start `active`. The ticket does not say otherwise, and a card that needs activating would not solve the problem Marcus described.
