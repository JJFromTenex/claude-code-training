# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Henry Hirshland
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team in Slack, who create them by hand. It takes hours, it happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a thread. Marcus Bell wants issuing in the console so the limit is typed once, by the person who owns it, into a field that validates.

## Current state

There is no card feature. `build-battle/merchant-console/CLAUDE.md` says so directly: "Cards is NWP-201 and does not exist yet." Everything below is what already exists and must be reused rather than rebuilt.

- `src/data/store.ts` — the in-memory store, held on `globalThis.__northwindStore` so dev-server module reloading does not hand each request a fresh copy. `Store` has `merchants`, `payments`, `refunds`, `disputes`, `payouts`. No `cards`.
- `src/data/generate.ts` — deterministic seed data from `mulberry32(SEED)` with a fixed `GENERATED_AT` of `2026-08-13T00:00:00.000Z`. One shared `rand` closure feeds every generator in the file, so **any new draw inserted mid-file shifts every subsequent record** and would break `src/data/queries.test.ts`.
- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"` already exists (`types.ts:1`). `Payment.amount` is documented "Integer minor units. Never a float." and `Payment.last4` is `string | null`. No `Card`.
- `src/data/queries.ts` — the single payment query builder (`parseFilters` → `filterPayments` → `sortPayments` → `paginate`). Cards are a different entity with different fields; this builder is not reusable for them, but its *shape* is the pattern to copy.
- `src/lib/money.ts` — `formatMoney`, `formatMoneyCompact`, `sumMinorUnits`, and `parseAmountToMinorUnits(input: string): number | null`, which already converts `"250"` / `"250.00"` to minor units at a boundary and returns `null` on anything else. This is the limit parser; writing a second one is the defect the rubric names.
- `src/lib/dates.ts` — `formatDate` (UTC, for tables) and `formatInZone(iso, timeZone)` (merchant's zone, for detail). Both already used by `src/app/payments/[id]/page.tsx`.
- `src/components/ui/payments/StatusBadge.tsx` — one badge keyed by three `Record<AnyStatus, …>` maps covering payment, dispute, and payout statuses. Card statuses belong in these maps, not in a second badge component.
- `src/app/payments/page.tsx` — the list pattern: an async server component calling the query layer directly, `TableRoot`/`Table` from `src/components/Table.tsx`, and a written empty state in a full-width `TableCell`.
- `src/app/payments/[id]/page.tsx` — the detail pattern: `notFound()` on a miss, a `<dl>` of `Field` rows, `Divider`, and a timeline.
- `src/app/siteConfig.ts` + `src/components/ui/navigation/AppSidebar.tsx` — nav is a `baseLinks` record read by a `navigation` array. A new route needs an entry in both.
- `src/components/` on `main` has `Input`, `Select`, `Button`, `Badge`, `Divider`, `Table`, `Drawer` — **but no `Dialog`**. `Dialog.tsx` is added by NWP-101, which is not on `main`. The issue flow must not depend on it.

**Where the ticket and the code disagree:** the ticket says "A form or dialog". On `main` there is no centred modal primitive, so this ships as a form, not a dialog.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge" | `merchant-console/CLAUDE.md` | A limit stored as `250` or `"$250"` authorises the wrong amount — the exact failure Marcus is reporting |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures" | `.claude/rules/cards.md` | A test fixture that looks like a PAN is a compliance incident in a training repo |
| "Generate on the server. A card number produced in the browser is a bug" | `.claude/rules/cards.md` | Client-generated numbers are guessable and unauditable |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes" | `.claude/rules/cards.md` | The full PAN becomes re-readable, which is the whole thing this rule exists to prevent |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI" | `.claude/rules/cards.md` | A cancelled card comes back to life from a stale tab |
| "Validate everything from the client against an allowlist before it reaches the store… Client-side checks are a convenience, never the enforcement" | `.claude/rules/api-routes.md` | A curl past the form writes a £0 or ¥ card |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user" | `.claude/rules/api-routes.md` | The form has nothing useful to render on failure |
| "Do not add a database, an ORM, or migrations" | ticket · Out of scope | Burns the clock and earns nothing |

## Approach

Add cards as a fourth entity alongside payments, disputes, and payouts, following the layering the repo already uses: types → store → an access module → routes → pages. `src/data/cards.ts` becomes the single card access path (`listCards`, `cardById`, `issueCard`, `transitionCard`, `parseCardInput`) in the same role `src/data/queries.ts` plays for payments, so there is one place a card is written and one place client input is checked. Number generation and the state machine go in `src/lib/cards.ts` beside the other pure helpers, each with a `.test.ts` next to it as `src/lib/` already does. The full PAN is returned by `POST /api/cards` and by nothing else: `issueCard` stores only `last4` and a `reference`, so there is no field for a later route to leak. The list and detail pages are server components reading the store directly — `merchant-console/CLAUDE.md` is explicit that a route handler is not added where a server component can read the store — and the only client leaves are the issue form and the freeze button, which need a POST and a PATCH.

**Considered and rejected:** a `/cards/new` page that redirects to the created card. It is the more conventional Next.js shape, but the reveal-once rule makes it wrong: the full number would have to travel in a query string or in a server-side "just created" flag, and both are a second place the PAN can be re-read. Keeping creation on one client component means the number exists only in the fetch response and in component state that a "Done" button clears. Also rejected: seeding cards inside the existing `generate()` draw sequence — it would shift `rand` for every payment after it and break `src/data/queries.test.ts`. Seed cards get their own `mulberry32` instance instead.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `MerchantCategory`, `CardIssueInput` beside the existing entities |
| `src/lib/cards.ts` | add | `luhnCheckDigit`, `generateCardNumber` (4242 BIN), `maskCard`, `canTransition` — pure, server-side, testable |
| `src/lib/cards.test.ts` | add | Luhn validity, BIN prefix, and every legal and illegal transition |
| `src/data/cards.ts` | add | The single card access path: `parseCardInput` allowlist, `issueCard`, `transitionCard`, `listCards`, `cardById`, `spendForCard` |
| `src/data/generate.ts` | change | `generateCards()` on its own PRNG seed so `/cards` is not empty and spend is real |
| `src/data/store.ts` | change | `cards: Card[]` on `Store` |
| `src/app/api/cards/route.ts` | add | `POST` issues and returns the full number exactly once |
| `src/app/api/cards/[id]/status/route.ts` | add | `PATCH` guards the state machine server-side |
| `src/app/cards/page.tsx` | add | The `/cards` list, server component, written empty state |
| `src/app/cards/[id]/page.tsx` | add | Card detail with spend against limit |
| `src/app/cards/issue-card.tsx` | add | Client form and the one-time success screen |
| `src/app/cards/card-actions.tsx` | add | Client freeze/unfreeze without a reload |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add `active`, `frozen`, `cancelled` to the existing maps rather than a second badge |
| `src/app/siteConfig.ts`, `.../AppSidebar.tsx` | change | `/cards` in nav |

## Plan

1. **Types and pure helpers** — `Card`/`CardStatus` in `types.ts`, then `src/lib/cards.ts`. Done when: `npx vitest run src/lib/cards.test.ts` passes, proving generated numbers start `4242`, pass a Luhn check, and that `cancelled → active` is refused.
2. **Store and access module** — `cards` on `Store`, `generateCards()` on its own seed, `src/data/cards.ts` with `parseCardInput`. Done when: `npm test` is still green, i.e. the new seed draw did not move any payment.
3. **Routes** — `POST /api/cards`, `PATCH /api/cards/[id]/status`. Done when: curl returns a full number once on create, a `400` with a readable message for a missing merchant / `0` limit / `5_000_001` limit / `JPY`, and a `409` for a transition out of `cancelled`.
4. **Read the diff.** Minor units end to end? Validation on the server, not just the form? Any helper reimplemented? This is the checkpoint before any UI exists.
5. **List and detail pages** — `/cards` and `/cards/[id]`, plus nav and the badge statuses. Done when: both render in the dev server, the list shows `•••• 4242`, and detail shows spend against limit.
6. **Issue form and success screen** — done when: submitting creates a card, the full number appears once, dismissing it clears it and the card is in the list masked.
7. **Stretch, in order** — freeze/unfreeze, spend progress bar amber past 80%, category lock, written error states.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Submit the form in the dev server; the new card appears in the list below it |
| Card list at `/cards` | Page renders nickname, merchant, `•••• 4242`, limit, status, created date |
| Card detail | `/cards/[id]` shows the full record and spend against the limit |
| Generated numbers, 4242 BIN, valid Luhn | `src/lib/cards.test.ts` — asserts the prefix and revalidates the check digit over many generated numbers |
| Reveal once, mask forever | Success screen shows the number; `GET`/detail/list payloads have no `number` field to return, asserted by the `Card` type having only `last4` |
| Server-side validation | curl each rejected case past the form and read the status code and message |
| Status transitions | `src/lib/cards.test.ts` covers every legal and illegal edge of the machine |

## Risks

- **Seed drift.** Adding a draw to the shared `rand` in `generate.ts` silently changes every payment after it. Mitigated by a separate `mulberry32` instance for cards; `npm test` catches it if that slips.
- **PAN leak through a payload.** Mitigated structurally: `Card` has no field for a full number, so no route can return one by accident.
- **Clock.** Six core criteria and tests first; the stretch list is ordered and anything unreached is left unclaimed in the PR rather than half-built.

## Out of scope

Persistence (NWP-203), auth, real card network calls, and editing a limit after issue (NWP-202). None are built.
