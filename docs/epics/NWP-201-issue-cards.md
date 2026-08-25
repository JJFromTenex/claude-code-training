# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Beshoy Eskarous
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants issuing in the console: create a card, see the cards issued, open one to check it.

## Current state

Cards do not exist. This is a greenfield feature inside an established codebase, so almost everything here is about which existing pattern to copy.

- `src/data/store.ts:18-24` — the `Store` interface holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. It needs a `cards` array. The store lives on `globalThis.__northwindStore` (line 34) specifically so dev-server module reloads do not hand each request a fresh copy — cards created through the UI survive until restart, which is the intended behavior.
- `src/data/types.ts` — has `Currency = "USD" | "EUR" | "GBP"` (line 1) and `Merchant` (line 14). No `Card` type, no `CardStatus`.
- `src/data/generate.ts:15-34` — deterministic seeding via `mulberry32(SEED)`, with `pick`/`between` helpers and a `pad(n, width)` id formatter (line 55). Seeded cards follow this so everyone in the room gets identical records.
- `src/data/queries.ts` — `paymentById`, `refundsForPayment`, `disputeForPayment` are the per-entity lookup pattern to match. **Nothing here filters cards**, and the "one query builder" rule is about *payment* filtering — a card lookup is a new entity, not a second implementation of an existing one.
- `src/app/payments/[id]/page.tsx:14-25` — the detail-page pattern: `await params`, look up by id, `notFound()` when missing, then a `<dl>` of fields. Card detail copies this shape exactly.
- `src/app/payments/page.tsx` — the list pattern: server component, `TableRoot`/`Table`/`TableRow` from `src/components/Table`, `StatusBadge`, and a written empty state at lines 93-104 (`colSpan`, a heading, a hint). Reuse all of it.
- `src/components/ui/payments/StatusBadge.tsx` — `AnyStatus` is a union of `PaymentStatus | DisputeStatus | PayoutStatus` with three parallel `Record` maps (`LABELS`, `DOTS`, `VARIANTS`). Adding `CardStatus` to the union means adding three entries per status — the compiler enforces it, so a missing one fails `tsc`, not review.
- `src/app/api/payments/route.ts` — route handlers are thin: parse, validate, delegate. `src/app/api/payments/export/route.ts` shows the 400 shape (`NextResponse.json({ message }, { status: 400 })`).
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` and **`parseAmountToMinorUnits(input)`** (line 45), which parses `"250"` / `"250.00"` to `25000` and returns `null` on anything malformed. This already exists and is exactly the boundary conversion this ticket needs; writing a second parser would cost points.
- `src/lib/dates.ts` — `formatDate`, `formatInZone`, `utcDayKey`. Cards store `createdAt` as a UTC ISO string like every other record.
- `src/components/` — `Drawer` (Radix dialog, focus-trapped), `Button`, `Input`, `Select`, `Badge`, `Divider`, `Table`. **There is no `Dialog` component** despite `components.md` claiming one, and no `Checkbox`/`RadioGroup`; `Drawer` plus labelled native inputs is the established combination.
- `src/components/ui/navigation/AppSidebar.tsx:29-47` — nav items read from `siteConfig.baseLinks`; `/cards` needs an entry in both.
- `src/lib/*.test.ts` — every helper has a `.test.ts` beside it, run by vitest. `npm test` is currently 36 passing on `main`.

**Nothing links a payment to a card.** `Payment` carries `merchantId`, not `cardId`, so card spend cannot be derived from payments without changing the payment model. Decision below.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`. Never a float, never a string with a dollar sign. Format once, at the edge." | `docs/tickets/NWP-201.md`, `merchant-console/CLAUDE.md` | Limits drift; a wrong limit is the exact failure this ticket exists to stop |
| "Every generated number starts `4242` and carries a valid Luhn check digit. Nothing here may resemble a real PAN, ever, including in tests and fixtures." | `.claude/rules/cards.md` | A number resembling a real PAN in a public training repo |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Client-generated numbers are guessable and untrusted |
| "Reveal once. The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | A full PAN persisted or re-readable — the most serious failure available here |
| "Status is a state machine. `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. **Guard the transition on the server**, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life via a hand-made request |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md`, `.claude/rules/api-routes.md` | The six validation criteria fail, and the client becomes the enforcement |
| "Do not add a database, an ORM, or migrations." | ticket, `CLAUDE.md` | Out of scope, scores nothing, costs the clock |

## Approach

Add a `Card` entity to the in-memory store and build the feature server-first: types, a Luhn generator on the `4242` BIN, a validated `POST /api/cards`, and a guarded `PATCH /api/cards/[id]` for status — each checked with a unit test or curl before any UI exists. Then three server components (`/cards` list, `/cards/[id]` detail, an issue dialog built on `Drawer`) plus one success screen that renders the full number returned by the creation response and never stores it.

The full number is generated, its last four and a `reference` are stored, and the number itself exists only in the `POST` response body. The client renders it into the success screen and drops it when the drawer closes — it is never written to the store, never returned by a list or detail route, and never held in state after the reveal.

**Spend:** `Card.spend` is an integer minor-unit field, `0` for newly issued cards, with ~4 deterministic seeded cards carrying varied spend (one above 80%) so the list, the detail view, and the amber progress bar have real data on first load. **Considered and rejected:** adding `cardId` to `Payment` and summing matching payments. Better data modelling, but it changes the `Payment` type and `generate.ts`, risks the NWP-101 export column contract, and buys nothing this ticket is scored on.

**Considered and rejected (numbers):** storing the full number encrypted and decrypting for an authorised re-reveal. That is a real issuing-platform design and explicitly wrong here — `cards.md` says the number lives in one response and nowhere else, and there is no auth in scope to gate a re-reveal.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory` |
| `src/lib/cards.ts` | add | `generateCardNumber`, `luhnCheckDigit`, `isValidLuhn`, `maskCardNumber`, `canTransition` — pure, no store access |
| `src/lib/cards.test.ts` | add | Luhn generator and status transitions (stretch goal, cheapest points, first tie-break) |
| `src/data/store.ts` | change | `cards: Card[]` on the `Store` interface and `createStore` |
| `src/data/generate.ts` | change | Seed ~4 deterministic cards with varied spend |
| `src/data/cards.ts` | add | `cardById`, `allCards`, `createCard`, `updateCardStatus` — store access, mirroring `queries.ts` |
| `src/app/api/cards/route.ts` | add | `POST` issue (validated), `GET` list |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` status, server-guarded against the state machine |
| `src/app/cards/page.tsx` | add | List: nickname, merchant, masked number, limit, status, created |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record + spend against limit |
| `src/app/cards/issue-dialog.tsx` | add | Client component: form, then the one-time reveal |
| `src/app/cards/freeze-button.tsx` | add | Client component: freeze/unfreeze via `router.refresh()`, no full reload |
| `src/components/ui/payments/StatusBadge.tsx` | change | Add `CardStatus` to `AnyStatus` + three map entries per status |
| `src/components/ui/navigation/AppSidebar.tsx`, `src/app/siteConfig.ts` | change | `/cards` nav entry |

## Plan

Sequenced so the server is provably correct before any UI exists.

1. **Types + `src/lib/cards.ts`** — `Card`, `CardStatus`, the Luhn generator on the `4242` BIN, masking, and `canTransition`. — done when: `tsc` is clean and the module has no store import.
2. **`src/lib/cards.test.ts`** — generated numbers start `4242`, are 16 digits, pass `isValidLuhn`, and differ across calls; `canTransition` allows `active⇄frozen` and either→`cancelled`, and rejects everything out of `cancelled`. — done when: `npm test` passes with the new file (this is a stretch goal, banked early).
3. **Store + seed** — `cards` on the store, ~4 deterministic seeded cards, one above 80% spend. — done when: the seeded cards are visible from a node one-liner or the list route.
4. **`POST /api/cards` + `GET /api/cards`** — validate merchant exists, limit is an integer `> 0` and `<= 5_000_000`, currency in `["USD","EUR","GBP"]`, nickname non-empty; reject with the 400 shape from the payments export route. — done when: curl proves each rejection *and* a success returns the full number exactly once.
5. **`PATCH /api/cards/[id]`** — status transitions guarded by `canTransition` on the server. — done when: curl proves `cancelled → active` returns 409/400 and `active → frozen` succeeds.
6. **Read the diff.** Minor units everywhere? Validation server-side? No second query builder? No full number on any record? — done when: those four are checked by eye before any component is written.
7. **`/cards` list + `/cards/[id]` detail** — server components copying the payments list/detail patterns, with written empty and error states. — done when: both render against seeded data in the browser.
8. **Issue dialog + one-time reveal** — `Drawer`, labelled inputs, `parseAmountToMinorUnits` at the boundary, success screen showing the full number, cleared on close. — done when: issuing a card in the browser shows the number once and the list shows `•••• 4242`.
9. **Freeze/unfreeze from the list** — `router.refresh()`, no full reload. — done when: the badge changes without a navigation.
10. **`/ship-ready`, `org-standards` on the diff, `npm test`, then push.**

## Verification

| Criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: submit the form, card appears in the list |
| Card list at `/cards` | Browser: all six columns render for seeded + newly issued cards |
| Card detail | Browser: open a card, full record + spend against limit |
| Generated numbers, `4242` BIN + Luhn | `src/lib/cards.test.ts`, plus the creation response in curl |
| Reveal once, mask forever | Browser: number on the success screen; `GET /api/cards` and the detail page contain no full number — grep the JSON response |
| Server-side validation | curl: missing merchant, `0`, `-1`, `5_000_001`, `"JPY"` each return 400 with a message |
| Status machine guarded server-side | curl: `cancelled → active` rejected |
| Freeze/unfreeze without reload | Browser: badge changes, no navigation |
| Spend progress amber past 80% | Browser: the seeded over-80% card shows amber |

## Risks

- **The clock.** Steps 1–6 are the score; 7–9 are the demo. If time runs short, a correct server with a plain list beats a polished dialog over a broken model.
- **Reveal-once leaking.** The easy mistake is putting the full number on the `Card` record "just for now". It must exist only in the `POST` response and the success screen's local state.
- **`StatusBadge` is shared.** Adding `CardStatus` to `AnyStatus` forces three map entries; a missing one is a `tsc` error, not a runtime surprise — good, but do not widen the type to `string` to dodge it.
- **Seeded cards are deterministic.** They go through `generate.ts`'s existing PRNG so every machine gets identical records; do not use `Math.random()`.

## Out of scope

- Persistence, auth, real card network calls, editing a limit after issue (NWP-202).
- Linking payments to cards (see rejected alternative).
- Re-revealing a card number after creation — deliberately impossible by design.

## Open questions

- **Merchant category lock** (stretch): the ticket says "chosen at issue time and shown on the card" but names no categories. Plan is a small fixed allowlist (`advertising`, `software`, `contractors`, `travel`, `other`) validated server-side like currency. If a canonical list exists elsewhere, use that instead.
- Whether ops needs to filter or search the card list. Not in the criteria; not building it unless the list gets long enough to demand it.
