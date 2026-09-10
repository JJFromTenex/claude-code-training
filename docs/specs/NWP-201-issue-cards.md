# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** fahad
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue a card, see what they have issued, and open one to check it — in the console, without a human in the middle.

## Current state

- `src/data/store.ts:16-32` — the in-memory `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. **No `cards` array.** Held on `globalThis.__northwindStore` so dev-server reloads don't reset it.
- `src/data/types.ts` — defines `Currency`, `PaymentStatus`, `DisputeStatus`, `PayoutStatus`, and the record interfaces. **No `Card` type, no `CardStatus`.**
- `src/data/generate.ts` — deterministic seeding with a fixed PRNG. Produces payments/refunds/disputes/payouts. **Generates no cards.**
- `src/app/api/` — only `payments/route.ts` and `payments/export/route.ts`, both `GET`. **There is no `POST` handler anywhere in this codebase.** NWP-201 introduces the first write path, so the request/response and error shape are being established here, not copied.
- `src/lib/money.ts:46` — `parseAmountToMinorUnits(input)` already converts `"250"` / `"250.00"` to `25000` and returns `null` on anything not exactly representable. This is the boundary converter the limit field needs; do not write a second one.
- `src/lib/money.ts:15` — `formatMoney(minorUnits, currency)` for display.
- `src/components/ui/payments/StatusBadge.tsx` — maps status → label/dot/variant across `PaymentStatus | DisputeStatus | PayoutStatus`. `CardStatus` is **not** in `AnyStatus`, so it must be added there or the badge will not typecheck.
- `src/app/payments/[id]/page.tsx` — the detail-page pattern to follow: `notFound()` on a miss, a `<dl>` of `<Field>`s, `Divider`, a timeline.
- `src/app/payments/page.tsx` — the list-page pattern: server component, `TableRoot`/`Table`, an explicit written empty state at line 93.
- `src/components/Drawer.tsx` — a Radix dialog wrapper, right-side sheet. Available for the issue form. Note it lacks a `"use client"` directive.
- Nav lives in `src/app/siteConfig.ts` (`baseLinks`), `src/components/ui/navigation/AppSidebar.tsx:41-47`, and `src/components/ui/navigation/Breadcrumbs.tsx:10-11`. A `/cards` route needs an entry in all three.

**Ticket vs code:** the ticket says card detail shows "its spend against the limit," but nothing links a payment to a card and no transaction model exists. Resolved below — the card carries its own `spent` total.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `CLAUDE.md`, ticket rule 1 | Limits drift; a `$50.00` limit stored as `50.00` compares wrong against `spent` |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | A generated number could resemble a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Number is guessable/forgeable from the client |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload." | `.claude/rules/cards.md` | Full PAN leaks from a list route — the thing the rule exists to prevent |
| "Mask everywhere else as `•••• 4242`." | `.claude/rules/cards.md` | Same |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md`, ticket rule 3 | A cancelled card comes back to life via a crafted request |
| "Validate everything from the client against an allowlist… Client-side checks are a convenience, never the enforcement." | `.claude/rules/api-routes.md` | Bad currency or negative limit reaches the store |
| "Never return a full card number from a list or detail route." | `.claude/rules/api-routes.md` | Same as reveal-once |
| "Storage and bucketing are UTC." | `CLAUDE.md` | `createdAt` drifts across midnight |

## Approach

Add a `Card` record to the existing in-memory store and build three thin layers on top of it: a server-side generator/validator module, a pair of route handlers, and three UI surfaces. The full card number is never stored — the generator returns it once to the creation route, which passes it straight into the creation response; only `last4` and an id persist on the record. Card mutation goes through a single `transition()` guard so the state machine is enforced in one place rather than at each call site. Spend is a `spent` field in minor units on the card itself, seeded with demo cards at boot so the list, the detail view, and the amber-past-80% bar all have real data to render.

**Considered and rejected:** deriving spend by joining payments to a card. There is no such link in the data model and inventing one (matching on merchant, say) would attribute unrelated payments to a card and produce numbers that look authoritative and are wrong. A `spent` field is honest about what it is.

**Also rejected:** storing the full PAN and masking at render. It reads as simpler and it directly violates the reveal-once rule — one careless `JSON.stringify` in a route handler leaks every number.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `Card`, `CardStatus`, `CardCategory` |
| `src/lib/cards.ts` | **add** | Luhn generator on the `4242` BIN, `maskCard`, `transition()` state guard, `validateCardInput()` allowlist. Pure and unit-testable |
| `src/lib/cards.test.ts` | **add** | Luhn check digit, `4242` prefix, every legal and illegal transition, validation rejections |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store` and `createStore()` |
| `src/data/generate.ts` | change | `generateCards()` — demo cards with varying spend, one past 80% |
| `src/data/cards.ts` | **add** | `allCards()`, `cardById()` — read helpers, mirroring `queries.ts` |
| `src/app/api/cards/route.ts` | **add** | `GET` list (masked), `POST` create — the reveal-once response |
| `src/app/api/cards/[id]/route.ts` | **add** | `PATCH` status transition, server-guarded |
| `src/app/cards/page.tsx` | **add** | The list, with a written empty state |
| `src/app/cards/[id]/page.tsx` | **add** | Detail + spend-against-limit bar |
| `src/app/cards/issue-dialog.tsx` | **add** | Client form → `POST`, then the one-time reveal |
| `src/app/cards/freeze-button.tsx` | **add** | Client `PATCH` + `router.refresh()`, no full reload |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add `CardStatus` to `AnyStatus` + the three maps |
| `src/app/siteConfig.ts`, `.../AppSidebar.tsx`, `.../Breadcrumbs.tsx` | change | `/cards` nav entry |

## Plan

Server first, then UI. Each step ends somewhere checkable.

1. **Types + `src/lib/cards.ts` + its tests** — done when: `npm test` passes with Luhn, BIN, transition, and validation cases green. No UI exists yet.
2. **Store + seed** — done when: a node/curl check shows seeded cards present, one with spend past 80% of its limit.
3. **`GET`/`POST /api/cards`** — done when: `curl` a valid POST returns `201` with the full number **once**; `curl GET` returns the same card with `last4` only and **no** full number anywhere in the payload.
4. **Validation rejections** — done when: `curl` proves `400` for missing merchant, `0`, negative, `5000001`, and `JPY`.
5. **`PATCH /api/cards/[id]`** — done when: `curl` proves `active→frozen→active` succeeds, `→cancelled` succeeds, and `cancelled→active` returns `409`.
6. **`/cards` list + nav** — done when: the seeded cards render masked, and the empty state is visible when the array is emptied.
7. **Issue dialog + one-time reveal** — done when: submitting in the browser creates a card, the number shows once, and it is gone after close (confirmed in the DOM, not by eye).
8. **`/cards/[id]` detail + spend bar** — done when: the bar is amber past 80% on the seeded card and blue below it.
9. **Freeze/unfreeze** — done when: the status flips in place with no full page reload.
10. **`/ship-ready`, then commit** — done when: checks pass and commits are prefixed `NWP-201:`.

Steps 1–5 are the core score. If the clock runs out, stop after the step you can prove and write the PR honestly.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: submit the dialog, card appears in the list. Plus `curl -X POST` returning `201` |
| Card list at `/cards` | Browser screenshot: nickname, merchant, `•••• 4242`, limit, status, created date |
| Card detail | Browser: open a seeded card, full record + spend against limit |
| Generated numbers, `4242` BIN + Luhn | `src/lib/cards.test.ts` — check digit verified by an independent Luhn sum in the test, and prefix asserted |
| Reveal once, mask forever | `curl POST` shows the number; `curl GET` list and detail greppped for it and **absent**; DOM checked after the success screen closes |
| Server-side validation | `curl` each of the five rejections, asserting `400` and a readable message |
| *Stretch:* freeze/unfreeze | Browser: click freeze, badge changes without a reload |
| *Stretch:* spend bar amber past 80% | Browser: seeded card above the threshold renders amber |
| *Stretch:* tests | `npm test` summary line pasted into the PR |
| *Stretch:* empty + error states | Browser: empty list, and a rejected submit showing the server's message |

## Risks

- **The reveal-once rule is the easiest thing to fail silently.** A route that returns the card record from `POST` by spreading the object will leak the number forever. Mitigation: the generator returns `{ card, fullNumber }` as separate values, and `fullNumber` is never assigned onto the record — so there is nothing to leak by accident.
- **Clock.** Ten steps in 45 minutes is tight. Core (1–5) is most of the score; stretch goals only count if core is green.
- **`StatusBadge` is shared.** Adding `CardStatus` to `AnyStatus` means the three `Record<>` maps must all gain the new keys or the build breaks — a compile error, so it will be caught, but it touches a payments file.
- **`Drawer.tsx` has no `"use client"`.** If reused, import it only from a client component.

## Out of scope

- **Persistence.** No database, ORM, or migration. Cards live until the dev server restarts — that is NWP-203.
- Authentication, roles, permissions.
- Real card network calls.
- Editing a limit after issue — NWP-202.
- The `sortPayments` amount-sort bug and the `metrics.ts` UTC/float bugs found earlier. Different tickets (NWP-102); fixing them here would bury them.

## Open questions

- None blocking. Spend-source ambiguity was resolved to a seeded `spent` field on the card; if a real transaction link is wanted later it replaces the field without changing the UI.
