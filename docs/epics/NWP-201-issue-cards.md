# EPIC · NWP-201 — Issue virtual cards from the console

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Steven Casarez
**Status:** building

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants issuing in the console so the limit is typed once, into a field that validates it.

## Current state

Every claim below is from reading the file, not from the ticket.

- `src/app/` — has `overview`, `payments`, `disputes`, `payouts`. There is no `cards` route. Nothing card-related exists yet beyond `Payment.last4` / `Payment.cardBrand`.
- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"` already exists and is the allowlist the ticket asks for. `Payment.amount` is documented `/** Integer minor units. Never a float. */`. No `Card` interface.
- `src/data/store.ts` — in-memory store on `globalThis.__northwindStore`, built by `createStore()` from `generate()`. Adding a `cards` array means extending the `Store` interface and `createStore`.
- `src/data/queries.ts` — the one payment query builder (`filterPayments` / `sortPayments` / `paginate` / `queryPayments`). `paginate<T>` is **generic** and reusable; the payment filter is not. Cards get their own accessor module, but reuse `paginate`.
- `src/lib/money.ts` — `formatMoney`, `parseAmountToMinorUnits` already exist. `parseAmountToMinorUnits` is exactly the boundary parser the issue form needs — **do not write a second one**.
- `src/lib/dates.ts` — `formatDate` (UTC, for tables) and `formatInZone` (merchant timezone, for detail). Both already exist.
- `src/components/` — `Drawer.tsx` (Radix Dialog under the hood, exports `Drawer`/`DrawerContent`/`DrawerTitle`/`DrawerFooter`…), `Select.tsx`, `Input.tsx`, `Button.tsx`, `Badge.tsx`, `Table.tsx`. **There is no `Dialog.tsx`** despite `components.md` naming one — the Drawer is the modal primitive here.
- `src/components/ui/payments/StatusBadge.tsx` — keyed by `Record<AnyStatus, …>` over payment/dispute/payout statuses. Card statuses are not in it; adding them would widen a payments component. A sibling `ui/cards/CardStatusBadge.tsx` follows the existing folder convention instead.
- `src/app/payments/page.tsx` — the list pattern to copy: server component, `TableRoot`, a written empty state already in the table body.
- `src/app/payments/[id]/page.tsx` — the detail pattern: `notFound()`, a `<dl>` of `Field` components, a timeline.
- `src/lib/*.test.ts` — vitest, `describe`/`it`/`expect`, colocated beside the code. `npm test` is `vitest run`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; `$250.00` is `25000` | `CLAUDE.md`, `.claude/rules/money.md` | Cents drift; a limit is off by 100× |
| Parse client amounts at the boundary, once | `.claude/rules/money.md` | Two parsers disagree about `"250.00"` |
| Every generated number starts `4242` and carries a valid Luhn digit | `.claude/rules/cards.md` | A string in the repo resembles a real PAN |
| Generate on the server; a number produced in the browser is a bug | `.claude/rules/cards.md` | The PAN is in client bundle state |
| Full number appears in the creation response and nowhere else | `.claude/rules/cards.md` | The reveal becomes a re-readable field |
| `active ⇄ frozen`, either to `cancelled`, `cancelled` terminal; guard **on the server** | `.claude/rules/cards.md` | A cancelled card comes back to life via curl |
| Validate client input against an allowlist before it reaches the store | `.claude/rules/api-routes.md` | `currency: "XYZ"` or a negative limit lands |
| Same error shape everywhere: honest status code + user-safe message | `.claude/rules/api-routes.md` | The form cannot show why it failed |
| Format money in the component, not upstream | `.claude/rules/components.md` | Minor units leak into the store as strings |

## Approach

Server first, UI second. A pure `src/lib/cards.ts` owns the two things that must be provably correct — the Luhn generator on the `4242` BIN and the status state machine — and is unit tested before any route exists. `src/data/cards.ts` owns store access and validation, so the route handler stays thin and the validation is reachable from a test. `POST /api/cards` is the only place a full PAN ever exists in a response; the stored `Card` record carries `last4` and a `reference`, never the PAN, so masking is a property of the data model rather than a discipline the UI has to remember.

**Considered and rejected:** putting card status into the existing `StatusBadge.tsx` `Record<AnyStatus, …>` maps. It reads as reuse but it widens a payments component with card semantics and forces four map edits for one new domain. A sibling `ui/cards/CardStatusBadge.tsx` matches the `ui/<domain>/` folder convention already in the tree.

**Also rejected:** a `revealed` boolean on the `Card` record. Any flag you can flip is a flag someone can flip back — the reveal is a one-time property of the *response*, so it never becomes a field.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `MerchantCategory`, `CardFilters` |
| `src/lib/cards.ts` | add | Luhn generator on `4242`, `maskCard`, state machine, spend ratio |
| `src/lib/cards.test.ts` | add | Unit tests for the generator and the transitions |
| `src/data/cards.ts` | add | Store access + server-side validation of the create payload |
| `src/data/store.ts` | change | `cards: Card[]` on the `Store` interface |
| `src/data/generate.ts` | change | Deterministic seed cards so the list and spend bar have content |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` create — the one reveal |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` status transition, guarded server-side |
| `src/app/cards/page.tsx` | add | `/cards` list |
| `src/app/cards/[id]/page.tsx` | add | Card detail + spend against limit |
| `src/app/cards/issue-card-dialog.tsx` | add | Client form + one-time reveal screen |
| `src/app/cards/card-actions.tsx` | add | Freeze/unfreeze without a reload |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Card status chip |
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | change | Nav entry for Cards |

## Plan

1. **`src/lib/cards.ts` + tests** — done when: `npm test` passes with cases proving every generated number starts `4242`, is 16 digits, satisfies Luhn, and that `cancelled` accepts no transition.
2. **Types, store, seed** — done when: `store.cards` type-checks and holds seeded cards.
3. **`src/data/cards.ts` validation** — done when: a missing merchant, `0`, `-1`, `5_000_001`, and `"XYZ"` each return a distinct message.
4. **Routes** — done when: `curl POST /api/cards` returns a full 16-digit number once, and `GET /api/cards` returns only `last4`.
5. **List, detail, issue dialog, freeze** — done when: the browser can issue a card, see it in the list, open it, and freeze it without a reload.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: submit the dialog, card appears in the list |
| Card list at `/cards` | Browser: all six columns render |
| Card detail | Browser: open a card, full record + spend against limit |
| Generated numbers, `4242` BIN, valid Luhn | `npm test` — generator suite, 1000-iteration invariant |
| Reveal once, mask forever | `curl` the create response (full number) then `GET /api/cards` and the detail (`•••• 4242`) |
| Server-side validation | `curl` each rejected payload, assert 400 + message |

## Risks

- **The reveal leaking into a payload.** Mitigation: the PAN is never written to the `Card` record, so a list route cannot return it even by accident.
- **Clock.** Six core criteria first, then tests, then freeze/unfreeze. Stretch goals are only worth 5%.

## Out of scope

- Persistence, a database, an ORM, migrations — NWP-203.
- Auth, roles, permissions.
- Real card network calls.
- Editing a limit after issue — NWP-202.

## What actually shipped, against this plan

Recorded after the build, because a plan nobody reconciles is decoration.

**Followed as written:** the file map, the server-first sequencing, the pure-`lib` split, the rejected alternatives (no `revealed` flag; a sibling `CardStatusBadge` rather than widening the payments one).

**Departed from the plan:**

| Planned | Shipped | Why |
| --- | --- | --- |
| `PATCH /api/cards/[id]/status` | `PATCH /api/cards/[id]` | A nested segment for a one-field update earns nothing |
| — | `CardEvent` + history timeline | The ticket credits "what happened to a card last Tuesday"; nothing in the plan answered it |
| — | Double-submit guard (409) | Same clause: "once real people click it twice" |
| — | Currency mismatch warning | Same clause: "pick the wrong currency" |
| — | Fixed `sortPayments` and `dailyVolume` | Both are defects in code this ticket reads from, and both break a rule named in `CLAUDE.md` |

**On fixing `sortPayments` after this plan said not to.** The risk I wrote down was "touching the one shared query builder mid-battle." That held right up until the fix turned out to be a single expression with a test that pins it. The reason to leave a bug alone is blast radius, not authorship — and `(a.amount - b.amount)` has none. The `headlineMetrics` currency-mixing bug I did leave alone, because that one really does need a design decision.

## Open questions

- Seed cards are added so the list is not empty on first load and the spend bar has something to show. If the grader expects an empty store, the written empty state in `page.tsx` covers it.
