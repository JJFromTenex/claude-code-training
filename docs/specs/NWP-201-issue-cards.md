# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Vishal Pallerla
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants the request, the limit, and the record in one place instead of a chat log.

## Current state

There is no card code in this repository — not a type, not a helper, not a route. Everything below already exists and is to be used rather than rewritten.

- `src/data/types.ts:1` — `Currency` is already `"USD" | "EUR" | "GBP"`, exactly the allowlist the ticket asks for. No `Card` interface, no card status union.
- `src/data/store.ts:16-22` — the `Store` interface has no `cards` field. The store is pinned to `globalThis.__northwindStore` (lines 34–38) so dev-server reloads do not hand each request a fresh copy. **A write path that reassigns `store` instead of mutating it appears to work, then loses data on the next reload.**
- `src/data/generate.ts:21,58` — deterministic seed via `mulberry32(SEED)`, anchored at `GENERATED_AT = 2026-08-13`. Generates payments, refunds, disputes, payouts. No cards.
- `src/lib/money.ts:46` — `parseAmountToMinorUnits()` already converts `"250.00"` → `25000` and returns `null` on bad input. `formatMoney()` (line 15) is the only place a decimal point appears.
- `src/data/queries.ts:18` — `parseFilters()` allowlists **payment** params only; it is not a general validator. `paginate()` (line 87) is generic.
- `src/app/api/payments/route.ts` — the route-handler shape here: parse, validate, `NextResponse.json()`. Four lines. **There is no `POST` handler anywhere in this app yet, and no server actions** — every handler today is a `GET`.
- `src/app/payments/page.tsx` / `payments/[id]/page.tsx` — the list-plus-detail pattern: async server component, Tremor `Table`, a written empty state (lines 93–104), `formatMoney` at the cell, `notFound()` on a bad id, a local `<Field>` helper on the detail page.
- `src/app/payments/filter-bar.tsx` — the app's only interactivity pattern: a `"use client"` leaf using `useRouter()`. No `fetch`, no client data store, no client-side data fetching anywhere.
- `src/components/ui/payments/StatusBadge.tsx` — the shared status renderer for payments, disputes **and** payouts, keyed on a closed `AnyStatus` union with three parallel maps. `active` / `frozen` / `cancelled` are absent.
- `src/components/` — **there is no `Dialog` component.** There is a Radix-backed `Drawer.tsx` with focus handling and an accessible close, plus `Input`, `Select`, `Button`, `Badge`, `Table`, `Divider`.
- `vitest.config.ts` — node environment, no jsdom. **Component behaviour cannot be unit-tested here**; only pure functions. Tests sit beside their code.
- Navigation is three hard-coded lists, not one config: `src/app/siteConfig.ts:6-9`, the `navigation` array in `AppSidebar.tsx:26-51`, and the `LABELS` map in `Breadcrumbs.tsx:7-12`. Miss the third and the crumb reads lowercase `cards`.

**Where the ticket and the code disagree:** ticket rule 2 says to store "the generated number's reference." No such concept exists here, and a retrievable handle to a PAN cuts against `cards.md`. Read as: store `last4`, store nothing else derived from the number.

## The six core acceptance criteria

Everything in the Core plan exists to satisfy exactly these. Nothing else is core.

| # | Criterion (ticket) | Mechanism |
| --- | --- | --- |
| C1 | **Issue a card.** Form takes nickname, merchant, spend limit, currency; submitting creates it and it appears in the list | `Drawer` form in `src/app/cards/issue-card-dialog.tsx` → `POST /api/cards` → `createCard()` mutates `store.cards` → `router.refresh()` re-renders the list |
| C2 | **Card list** at `/cards`: nickname, merchant, masked number, spend limit, status, created date | `src/app/cards/page.tsx`, server component calling `listCards()`; six columns; written empty state |
| C3 | **Card detail** shows the full record and its spend against the limit | `src/app/cards/[id]/page.tsx`; spend and limit rendered as text via `formatMoney` — **the progress bar is stretch, the numbers are core** |
| C4 | **Generated numbers** server-side, `4242` BIN, valid Luhn check digit | `generateCardNumber()` in `src/lib/cards.ts`, imported only by the route handler |
| C5 | **Reveal once, mask forever** — full number exactly once, on the success screen; `•••• 4242` everywhere else | See "The reveal-once boundary" below |
| C6 | **Server-side validation** — reject missing merchant, zero or negative limit, limit above 5,000,000 minor units, currency outside `USD/EUR/GBP` | See "Server-side validation" below |

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` #1 | The `$50,000` cap silently becomes `$500` |
| "Never parse a currency string into a number… validated and converted at the boundary, once" | `.claude/rules/money.md` | Two parsers disagree; the stored limit stops matching what ops typed |
| "`toFixed` is a display call. If its result is stored or compared, that is a bug." | `.claude/rules/money.md` | Cents drift |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Unshippable; puts PAN generation in a client bundle |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | Something in the repo resembles a real PAN |
| "Reveal once… not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | The number becomes re-readable, which is the whole point |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card comes back to life via a crafted request |
| "Validate everything from the client against an allowlist… Client-side checks are a convenience, never the enforcement." | `.claude/rules/api-routes.md` | The cap and the currency list are bypassable |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | The form has nothing to display |
| "Never return a full card number from a list or detail route." | `.claude/rules/api-routes.md` | C5 fails |
| "Storage and bucketing are UTC." | `merchant-console/CLAUDE.md` #2 | `createdAt` sorts wrong across the Berlin and London merchants |
| No database, ORM or migrations | ticket, out of scope | Costs the clock, earns nothing |

## Integer minor units — where the conversion happens

One conversion in, one format out. No other arithmetic on money.

- **In, once:** the form posts the limit as the string ops typed. `POST /api/cards` calls `parseAmountToMinorUnits()` (`src/lib/money.ts:46`) — `null` is a validation failure, not a fallback to `0`. Nothing downstream ever sees a decimal string.
- **Stored:** `Card.spendLimit` and `Card.spend` are integer minor units, each travelling with the card's `currency`.
- **Compared:** the `5_000_000` cap is compared against the parsed integer, never against the input string or a float.
- **Out, at the edge:** `formatMoney(minorUnits, currency)` in the table cell and the detail field. No formatted value is ever stored or compared.
- **Not written:** no second parser, no second formatter, no `Number(input)`, no `toFixed` outside display.

## Luhn verification

`generateCardNumber()` produces a 16-digit number: the literal `4242` BIN, 11 digits from a server-side random source, then a check digit computed so the whole number satisfies Luhn. `luhnCheckDigit(digits)` is a separate exported pure function so it can be asserted directly. Both live in `src/lib/cards.ts`, are imported only by `src/app/api/cards/route.ts`, and never reach a client bundle.

Tests in `src/lib/cards.test.ts` assert: the number is 16 digits; it starts `4242`; an independent `luhnIsValid()` check passes over many generated numbers; and mutating any single digit makes that check fail — which is what proves the digit is doing work rather than being decorative.

## The reveal-once boundary

The boundary is a data-shape decision, not a UI discipline, so there is nothing to leak.

| Location | Holds the full number? |
| --- | --- |
| `generateCardNumber()` return value, in the route handler | Yes — the only place it exists |
| `Card` record written to `store.cards` | **No.** The type has `last4: string` and no PAN field at all |
| `POST /api/cards` response body | Yes — exactly once, alongside the created card |
| Success panel in `issue-card-dialog.tsx` | Yes — held in component state for that render only |
| That state after the panel closes | **No.** Cleared on close, so re-opening the drawer cannot show it |
| `/cards` list, `/cards/[id]` detail, any later response | **No.** They read `store.cards`, which never had it |

Masking is `maskedNumber(last4)` → `•••• 4242`, used by both pages. Because the PAN is absent from the record, C5 cannot be broken by forgetting to mask — only by adding a field this spec does not define.

## Server-side validation

In `POST /api/cards`, before anything reaches the store. Reject early and return; the client form's own checks are convenience only.

| Input | Rule | Response |
| --- | --- | --- |
| `merchantId` | Must be present **and** resolve via `merchantById()` (`src/data/merchants.ts:90`) | `400` |
| `spendLimit` | `parseAmountToMinorUnits()` must return non-`null`; must be `> 0` | `400` |
| `spendLimit` | Must be `<= 5_000_000` minor units | `400` |
| `currency` | Must be one of the `Currency` union — the existing allowlist, not a new list | `400` |
| `nickname` | Must be present and non-empty after trim | `400` |

Every rejection returns the same shape — `{ error: "<message safe to show ops>" }` — and the drawer renders it. Unknown card id on detail is `notFound()`, matching `payments/[id]`.

## Reuse of existing helpers

A second implementation of any of these is a defect, not a shortcut.

| Helper | Path | Used for |
| --- | --- | --- |
| `parseAmountToMinorUnits()` | `src/lib/money.ts:46` | The one limit conversion, at `POST` |
| `formatMoney()` | `src/lib/money.ts:15` | Limit and spend, at the cell and the detail field |
| `formatDate()` | `src/lib/dates.ts:31` | Created-date column |
| `formatInZone()` | `src/lib/dates.ts:22` | Created timestamp in the merchant's timezone on detail, as `payments/[id]` does |
| `merchantById()`, `merchants` | `src/data/merchants.ts:90,7` | Validating `merchantId`, resolving the name, populating the merchant `Select` |
| `Currency` | `src/data/types.ts:1` | The currency allowlist |
| `store` + `globalThis` pinning | `src/data/store.ts:34` | Where `cards` lives; mutate in place |
| `mulberry32`, `GENERATED_AT` | `src/data/generate.ts:21,58` | Deterministic seeded cards |
| `StatusBadge` | `src/components/ui/payments/StatusBadge.tsx` | Status column — extend the union, do not write a second badge |
| `Drawer`, `Input`, `Select`, `Button`, `Badge`, `Table`, `Divider` | `src/components/` | The issue form and list chrome. No new dependency |
| `notFound()` | `next/navigation` | Unknown card id |

**Deliberately not reused:** `parseFilters()` (`src/data/queries.ts:18`) is a payment-param allowlist, not a general validator. A card list is not a second payment filter path, so `api-routes.md`'s "reuse the query builder" rule is not in play here. `paginate()` is available but unused — the list is unpaginated at seed volume.

## Approach

Cards become a fourth entity alongside payments, refunds and disputes, in the shape the app already uses: a type in `src/data/types.ts`, a `cards` array on the in-memory store, pure helpers in `src/lib/cards.ts`, store access in `src/data/cards.ts`, and `/cards` plus `/cards/[id]` as server components. One write path — `POST /api/cards` — because that is where `api-routes.md` puts validation and where reveal-once can be a response shape rather than page state. The number is generated server-side, returned once, rendered on a success panel, and never written to the store. The list refreshes via `router.refresh()` from the drawer, the same `useRouter` pattern `filter-bar.tsx` already uses; there is no client-side data fetching to add.

Seeded cards earn their place against **C3**, not the stretch bar: with an empty store every card sits at zero spend forever and "its spend against the limit" is vacuous. `generate.ts` seeds three cards deterministically — one low spend, one past 80%, one frozen — so C2, C3 and the status column are all provable on screen.

**Considered and rejected:** a React Server Action for issuing, which would skip the route handler and is arguably more idiomatic for Next 15. Rejected because there are no server actions anywhere in this codebase, and because the rules that govern this work — the allowlist rule, the error-shape rule, "never return a full card number" — are written against `src/app/api/**` and load when you open those files. Putting the write path where the rules already point beats the newer idiom here.

**Also rejected:** deriving spend from each merchant's captured payments. Realistic numbers with no new seed data, but a card issued today did not process a payment from 120 days ago, and the invented link is the first thing a reviewer would pull on.

## File map

**Core**

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `Card` (`id`, `nickname`, `merchantId`, `last4`, `spendLimit`, `spend`, `currency`, `status`, `createdAt` — **no PAN field**) and `CardStatus` |
| `src/lib/cards.ts` | add | `generateCardNumber()`, `luhnCheckDigit()`, `luhnIsValid()`, `maskedNumber()`, `canTransition()` |
| `src/lib/cards.test.ts` | add | Luhn validity and digit sensitivity, `4242` prefix, 16-digit length, masking, every legal and illegal transition, `cancelled` terminality |
| `src/data/cards.ts` | add | `listCards()`, `cardById()`, `createCard()` — mutates `store.cards` in place, never reassigns |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store` and `createStore()` |
| `src/data/generate.ts` | change | Seed three deterministic `4242` cards: low spend, past 80%, one frozen |
| `src/app/api/cards/route.ts` | add | `POST` only: validate, generate server-side, return the full number exactly once. **No `GET`** — nothing would call it |
| `src/app/cards/page.tsx` | add | The six-column list, written empty state |
| `src/app/cards/[id]/page.tsx` | add | Full record plus spend and limit as text |
| `src/app/cards/issue-card-dialog.tsx` | add | `"use client"` leaf: labelled `Drawer` form, server errors rendered, success panel showing the number once and clearing it on close |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend `AnyStatus` and all three maps with `active`, `frozen`, `cancelled` |
| `src/app/siteConfig.ts` | change | Add `cards: "/cards"` to `baseLinks` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Add the Cards `navigation` entry; `CreditCard` is taken by Payments |
| `src/components/ui/navigation/Breadcrumbs.tsx` | change | Add `cards: "Cards"` to `LABELS` |

**Stretch — only if core is done and verified**

| File | Add or change | Why |
| --- | --- | --- |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` status, guarded by `canTransition` on the server |
| `src/app/cards/card-actions.tsx` | add | Freeze / unfreeze calling `PATCH` then `router.refresh()` |
| `src/components/ui/cards/SpendProgress.tsx` | add | Bar showing spend against limit, amber past 80% |
| `src/lib/cards.ts` | change | `spendRatio()` for the bar's threshold, with tests |

## Plan

Core, sequenced so each step ends somewhere verifiable.

1. **Types, store slot, pure helpers, tests** — done when: `npm test` passes with `src/lib/cards.test.ts` green on Luhn, prefix, length, digit sensitivity, masking and every transition. Nothing renders yet. *(C4, and rule 3)*
2. **Seed cards and the store access layer** — done when: `listCards()` returns the three seeded cards with identical ids across two dev-server reloads, proving the `globalThis` pinning was not broken.
3. **`/cards` list plus navigation wiring** — done when: the sidebar shows Cards with an active highlight, `/cards` lists the seeded cards with masked numbers and formatted limits, and the breadcrumb reads "Cards". *(C2)*
4. **`POST /api/cards` with full validation** — done when: `curl` proves each of the five rejections returns `400` and a displayable message, and a valid request returns the created card plus the full number once. *(C6, C4)*
5. **Issue drawer wired to the route** — done when: submitting creates a card, the success panel shows the full number, closing returns to the list with the new card present and masked, and re-opening the drawer cannot show the previous number. *(C1, C5)*
6. **`/cards/[id]` detail** — done when: a seeded card shows its record with spend and limit formatted, and an unknown id gives `notFound()`. *(C3)*
7. **`npm run build`, then `/ship-ready`** — done when: both are clean. `build` is the only thing in the documented workflow that type-checks components.

Stretch, in this order if the clock allows: `PATCH` + freeze/unfreeze, then `SpendProgress`, then category lock.

## Verification

| Criterion | How it is proven |
| --- | --- |
| **C1** Issue a card | Submit the drawer on `/cards`; the card appears in the list without a full page load |
| **C2** Six-column list at `/cards` | Load `/cards` and read the row |
| **C3** Detail shows record and spend against limit | Open the seeded card; spend and limit render via `formatMoney` against the same currency |
| **C4** Server-side, `4242`, valid Luhn | `src/lib/cards.test.ts`: prefix, length, `luhnIsValid()` over many generated numbers, and failure when one digit is mutated. Generation is imported only by the route handler |
| **C5** Reveal once, mask forever | Success panel shows it; `Card` has no PAN field, so grepping the list and detail payloads finds `last4` only; close and re-open the drawer, then reload the detail page — the number is gone from both |
| **C6** Server-side validation | `curl` all five rejections against `POST /api/cards` with the client bypassed: missing merchant, unknown merchant, `0`, `-100`, `5000001`, `JPY` |
| Minor units end to end | `npm test` on `money.test.ts` stays green; `curl` with `"spendLimit": "250.00"` stores `25000` and the detail renders `$250.00` |
| State machine | `src/lib/cards.test.ts` covers every legal and illegal transition and `cancelled` terminality, whether or not `PATCH` ships |
| Empty and error states | Validation errors render in the drawer. The list's empty state is unreachable once cards are seeded — proven by reading the branch, and called out in the PR so it does not read as a missed criterion |
| *Stretch* freeze / unfreeze | Click freeze; the badge changes with no navigation. `curl cancelled → active` is rejected server-side |
| *Stretch* amber past 80% | The card seeded above 80% renders amber; the threshold is unit-tested |

## Risks

- **Reassigning `store` instead of mutating it.** The classic failure: writes work, then vanish on reload. Step 2 checks it explicitly.
- **`StatusBadge`'s closed union.** Three parallel maps; missing one is a runtime `undefined` in a class string, not a type error.
- **Scope drift into the stretch list.** The progress bar and freeze/unfreeze read as core and are not. Core is done at step 7; everything after is optional.
- **Seeding makes the empty state unreachable.** A deliberate trade so C3 is not vacuous. Called out in the PR.
- **45 minutes.** Steps 1–6 are the score. If time runs short, ship after step 7 with no stretch work.

## Out of scope

- Persistence of any kind — no database, ORM or migration. Cards live until the dev server restarts. That is NWP-203.
- Authentication, roles, permissions.
- Real card network or issuer calls.
- Editing a card's limit after issue — NWP-202.
- Filtering, sorting or pagination on the card list. The ticket asks for "every issued card".
- A `GET /api/cards` endpoint. Pages are server components that read the data layer directly; nothing in this app fetches its own API.

## Open questions

- Ticket rule 2's "the generated number's reference" has no counterpart here. Reading it as `last4` and nothing else — worth confirming with Marcus that no retrievable handle is expected.
- May a card's currency differ from its merchant's? The ticket lets ops pick from `USD/EUR/GBP` while every merchant has one fixed currency (`src/data/merchants.ts`). Allowing the mismatch for now, validating against the allowlist only — but `money.md` warns that totals across currencies are a bug, so this matters the moment anything sums cards.
- Can two cards share a nickname for the same merchant? Nothing says no, so nothing enforces it.
