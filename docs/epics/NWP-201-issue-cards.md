# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Hoseong Liam Hwang
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants the whole thing in the console: issue a card, see the cards issued, open one to check it.

## Current state

- `src/data/store.ts:16-22` — the `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. **There is no `cards` array.** The store is pinned to `globalThis` (`store.ts:24-27`, `36-38`) so dev-server module reloading does not hand each request a fresh copy — cards issued during a session survive until restart, which is exactly the behaviour the ticket wants.
- `src/data/types.ts:1` — `Currency = "USD" | "EUR" | "GBP"`, already the allowlist the ticket asks us to validate against. No `Card` or `CardStatus` type exists.
- `src/data/merchants.ts:7` — the merchant list. Every merchant carries its own `currency` and an id shaped `mch_01`.
- `src/data/generate.ts:55` — `pad(n, width)`, and the id convention: `pay_000001`, `re_`, `dp_`, `po_`. Card ids should follow it.
- `src/data/queries.ts:108` — `paymentById`. Record lookups live in this file; card lookups belong beside it, not in a new module.
- `src/lib/money.ts:15` — `formatMoney(minorUnits, currency)`. `parseAmountToMinorUnits` (`money.ts:46`) already converts user input like `"250.00"` to minor units at a boundary, with a `null` on bad input. **Both already exist; a second money helper is a defect.**
- `src/lib/dates.ts:31` — `formatDate` for table timestamps.
- `src/components/ui/payments/StatusBadge.tsx` — `LABELS`/`DOTS`/`VARIANTS` keyed by `AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus`. Card statuses should extend this union rather than get their own badge.
- `src/app/payments/filter-bar.tsx` — the house pattern for an interactive island: `"use client"`, props in from a server page, `router` out.
- `src/app/siteConfig.ts:5-10` and `src/components/ui/navigation/AppSidebar.tsx:26-50` — nav lives in two places and has no Cards entry. `CreditCard` is already imported at `AppSidebar.tsx:20`.
- **Docs vs code:** `.claude/rules/components.md` claims `src/components/` has a `Dialog`. It does not — the Radix-dialog primitive is `src/components/Drawer.tsx`, and there is no `Checkbox` or `RadioGroup` either.
- `merchant-console/CLAUDE.md` confirms it: "Cards is NWP-201 and does not exist yet." Nothing to reuse; everything here is new.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." Format once, at the edge. | `CLAUDE.md`, ticket rule 1 | Limits drift; a card is issued for the wrong amount |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md`, ticket rule 4 | Repo contains something resembling a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Number generation is trivially tampered with |
| "Reveal once… not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md`, ticket rule 2 | The leak this ticket must not ship |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md`, ticket rule 3 | A cancelled card comes back to life |
| "Anything from the client… is checked against an allowlist before it reaches a query, a filename, or the store." | `CLAUDE.md` §4 | Core criterion 6 fails outright |
| "Do not add a database, an ORM, or migrations." | `CLAUDE.md`, ticket Out of scope | Costs the clock, earns nothing |

## Approach

Add a `Card` record to the in-memory store and drive everything through server routes. `src/lib/cards.ts` owns number generation (a `4242` prefix, random middle, computed Luhn check digit), masking, and the status transition table — all pure, all unit-tested beside the code as `src/lib/money.ts` and its test do. `POST /api/cards` validates nickname, merchant, limit, and currency against allowlists, generates the number server-side, stores **only** the last four plus a reference, and returns the full number exactly once in the creation response. `GET /api/cards`, `GET /api/cards/[id]`, and `PATCH /api/cards/[id]` never see it. The UI is a `/cards` server page listing masked cards with an issue drawer and inline freeze/unfreeze, plus `/cards/[id]` showing the full record and a spend-against-limit bar.

**Considered and rejected:** keeping the generated number on the `Card` record and masking it at render time. It is less code and it is the exact failure the rules name — one careless `JSON.stringify` in a list payload and the PAN ships. Storing `last4` plus a reference makes the leak structurally impossible rather than conventionally avoided.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`; extend nothing else |
| `src/data/store.ts` | change | `cards: Card[]` on the store, seeded so the list and spend bar have something real |
| `src/data/cards-seed.ts` | add | A few issued cards with spend, so detail is not empty on first load |
| `src/lib/cards.ts` | add | Number generation on the `4242` BIN, Luhn, masking, transition guard |
| `src/lib/cards.test.ts` | add | Luhn and transitions — the stretch goal that is also the tie-break |
| `src/data/queries.ts` | change | `listCards`, `cardById` beside `paymentById` |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue (validated, reveals once) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail (masked), `PATCH` status transition, server-guarded |
| `src/app/cards/page.tsx` | add | The `/cards` list |
| `src/app/cards/issue-dialog.tsx` | add | Client island: the issue form and the one-time reveal |
| `src/app/cards/card-actions.tsx` | add | Client island: freeze/unfreeze without a full reload |
| `src/app/cards/[id]/page.tsx` | add | Card detail and the spend bar |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add the three card statuses to the existing badge rather than writing a second one |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | A route nobody can navigate to is not shipped |

## Plan

1. **Types, store, seed** — done when: `store.cards` exists with seeded records and `npm run build` still passes.
2. **`src/lib/cards.ts` + tests** — done when: generated numbers start `4242`, pass a Luhn check, and every legal and illegal transition is asserted; `npm test` green.
3. **API routes** — done when: `curl -X POST /api/cards` with a good body returns the full number once and a `201`; a bad merchant, a `0` limit, a limit over 5,000,000, and a `JPY` currency each return `400`; `GET /api/cards` shows no full number anywhere.
4. **`/cards` list + issue drawer + freeze** — done when: issuing from the UI adds a row, the number is shown once and is gone after close, and freeze/unfreeze flips a row without a page reload.
5. **`/cards/[id]` + spend bar** — done when: the bar reflects spend against limit and turns amber past 80%.
6. **Nav, `/ship-ready`, PR** — done when: Cards appears in the sidebar, the checks are clean, and the PR states which criteria are met.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | POST via curl returns `201`; issuing in the UI adds the row |
| Card list at `/cards` | Route renders nickname, merchant, masked number, limit, status, created date |
| Card detail | `/cards/[id]` shows the record and spend against limit |
| Generated numbers, `4242` BIN + Luhn | Unit tests in `src/lib/cards.test.ts` assert prefix and check digit over many generations |
| Reveal once, mask forever | Creation response carries `number`; `GET` list and detail responses grepped for it and it is absent |
| Server-side validation | Four `curl` cases each returning `400` with a user-safe message |

## Risks

- **The reveal leaking into a later payload.** Mitigated structurally: the full number is never written to the `Card` record, so no route can return it.
- **Client-side-only transition guards.** The `PATCH` route validates the transition itself; the UI merely hides buttons.
- **Float money creeping in via the limit input.** The form collects a string and `parseAmountToMinorUnits` converts once, at the boundary.
- **Time.** Core criteria before any stretch goal; the ticket says so and so does the rubric.

## Out of scope

- Persistence of any kind — NWP-203, and explicitly forbidden here.
- Auth, roles, permissions. Real card-network calls. Editing a limit after issue (NWP-202).

## Open questions

Both were resolved during the build. Recorded here with what shipped, so the
plan and the code do not drift apart.

- **Where does a card's spend come from?** No payment in the store links to a
  card, and the ticket does not say. **Resolved:** `spent` is a minor-units
  field on the `Card`, zero for anything issued through the console. Seeded
  cards derive theirs in `src/data/cards-seed.ts` from real captured payments
  for that merchant and currency in the three days after issue, capped at the
  limit. The window is a stated modelling choice; the figures are real rows and
  move when the seed does. A payment-to-card join was not invented.
- **Must a card's currency match its merchant's?** The ticket requires only the
  three-currency allowlist. **Resolved: yes, enforced.** `validateIssueRequest`
  rejects a mismatch by name — "Lumen Coffee Roasters settles in USD" — because
  a card issued in a currency its merchant does not trade in is one nobody can
  reconcile. Covered by a test.
