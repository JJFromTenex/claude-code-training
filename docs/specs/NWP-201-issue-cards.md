# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Yusif
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It happens twelve to twenty times a week, takes hours each time, and last month two cards were created with the wrong spend limit because the request lived in a Slack thread. Ops needs to issue a card, see the cards they have issued, and open one to check it — without leaving the console.

## Current state

- `src/app/` — overview, payments, disputes, payouts routes exist. **No `/cards` route.** `merchant-console/CLAUDE.md` says so explicitly: "Cards is NWP-201 and does not exist yet."
- `src/data/store.ts` — in-memory store on `globalThis.__northwindStore`, seeded by `src/data/generate.ts` at boot. Holds `merchants`, `payments`, `refunds`, `disputes`, `payouts`. **No `cards` collection.**
- `src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"`, `Merchant` (with `currency` and IANA `timezone`), `Payment` etc. No card types.
- `src/lib/money.ts` — `formatMoney`, `sumMinorUnits`, and `parseAmountToMinorUnits` ("Parse user input like \"250\" or \"250.00\" into minor units. Boundary only."). **The limit input parser already exists; writing a second one is the defect `CLAUDE.md` convention 3 warns about.**
- `src/lib/dates.ts` — `formatDate` (UTC, for tables), `formatInZone` (merchant timezone, for detail pages). Both reused as-is.
- `src/components/` — `Drawer`, `Button`, `Input`, `Select`, `Badge`, `Table` primitives (Tremor/Radix). No feature uses `Drawer` yet, so the card form is its first consumer; `src/app/payments/filter-bar.tsx` is the house pattern for a client component with controlled inputs; `src/app/payments/[id]/page.tsx` is the house pattern for a detail page; `src/components/ui/payments/StatusBadge.tsx` is the house pattern for a status badge.
- `src/app/api/payments/route.ts` — the route-handler pattern: parse, validate against an allowlist, answer with `NextResponse.json`.
- `src/components/ui/navigation/AppSidebar.tsx` + `src/app/siteConfig.ts` — the nav; Cards must be added to both.
- One ticket claim checked against the code: the ticket says "form or dialog". The repo has no `Dialog` component — its overlay primitive is `Drawer` (`src/components/Drawer.tsx`), so far unused by any feature. We use `Drawer`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | Cents drift; limits stored as floats |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | Repo data resembles a real PAN |
| "The full number appears in the creation response and nowhere else." | `.claude/rules/cards.md` | A stored PAN leaks via list/detail/export |
| "Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Validate everything from the client against an allowlist." | `.claude/rules/api-routes.md` | Bad limit/currency reaches the store |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside `USD`, `EUR`, `GBP`." | ticket NWP-201 | The two wrong-limit incidents recur |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Client-trust violation |
| "Do not add a database, an ORM, or a migration." | ticket NWP-201, out of scope | Points lost, clock lost; persistence is NWP-203 |

## Approach

Add a `cards` collection (plus an append-only `cardEvents` audit log) to the existing in-memory store, a small pure card library in `src/lib/cards.ts` (Luhn generation on the 4242 BIN, masking, the status state machine, category allowlist) with unit tests beside it, and four route handlers under `src/app/api/cards/` that do all validation server-side. The UI is three pieces in the house style: a Cards entry in the sidebar, a `/cards` list page with an issue drawer (reveal-once success screen) and row-level freeze/unfreeze/cancel, and a `/cards/[id]` detail page with spend-against-limit progress and the audit trail. The full card number exists only in the POST response and in the drawer's success state, which is cleared on close.

**Considered and rejected:** seeding zero cards and letting the list start empty. Rejected because the detail page's spend-progress and the list's status variety would then be unreachable in review without manual setup; `generate.ts` already seeds every other collection deterministically, and `CLAUDE.md` says "If you need more seed data, add it to the JSON." Seed cards store only last four and a reference — never a full number, per reveal-once. Also rejected: a modal `Dialog` for the issue form (no such component exists here; `Drawer` is the house pattern) and a `PATCH /api/cards/[id]` for status (a dedicated `/status` action route keeps the transition guard in one place).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardEvent`, `CardCategory` types |
| `src/data/generate.ts` | change | Deterministic seed cards + their audit events |
| `src/data/generate.test.ts` | add | Unit tests: seed determinism, spend derived from the merchant's own payments |
| `src/data/store.ts` | change | `cards` + `cardEvents` collections (defensive init for hot-reloaded stores) |
| `src/data/cards.ts` | add | Store accessors: list, byId, events, create, transition |
| `src/lib/cards.ts` | add | Luhn generate/validate on 4242 BIN, `maskCard`, `canTransition`, category allowlist |
| `src/lib/cards.test.ts` | add | Unit tests: Luhn generator + full state-machine matrix |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` create (validates, reveal-once response, idempotency key) |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail (masked, with spend + events) |
| `src/app/api/cards/[id]/status/route.ts` | add | `POST` freeze/unfreeze/cancel, state machine guarded server-side |
| `src/app/siteConfig.ts` | change | `cards` base link |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Cards nav item |
| `src/components/ui/navigation/Breadcrumbs.tsx` | change | `cards` path label, so the new routes render a breadcrumb |
| `CLAUDE.md` | change | Layout table no longer says cards does not exist |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Status badge in the house `StatusBadge` style |
| `src/app/cards/page.tsx` | add | List page: table, written empty state, issue drawer trigger |
| `src/app/cards/issue-drawer.tsx` | add | Issue form + reveal-once success screen (client) |
| `src/app/cards/row-actions.tsx` | add | Freeze/unfreeze/cancel without a full page reload (client) |
| `src/app/cards/cancel-confirm.ts` | add | Pure arm/disarm rules for the two-click cancel, DOM-free so they can be tested |
| `src/app/cards/cancel-confirm.test.ts` | add | Unit tests: blur inside/outside the row, null related target, Escape, timeout, success |
| `src/app/cards/[id]/page.tsx` | add | Detail: record, spend progress (amber past 80%), category lock, audit trail |

## Plan

1. **Types, seeds, store, `src/lib/cards.ts`, tests** — done when: `npm test` passes with the new `cards.test.ts` green alongside the existing 28.
2. **API routes** — done when: `curl` shows the validation matrix rejecting each bad input with a 400 and a safe message, the state machine returning 409 on illegal transitions, and no full number in any list/detail payload.
3. **UI: sidebar, list, drawer, detail** — done when: a card issued in the browser appears in the list, its number is visible exactly once, and freeze/unfreeze updates the row without a full reload.
4. **Gates + `/ship-ready`** — done when: `npm test`, `npm run lint`, `npm run build` all exit 0 and the ship-ready checklist reports clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: fill drawer, submit, card appears in list. `curl -X POST` shows the created record |
| Card list | Browser `/cards`: nickname, merchant, masked number, limit, status, created date all render |
| Card detail | Browser `/cards/<id>`: full record + spend against limit |
| Generated numbers | `cards.test.ts`: starts `4242`, 16 digits, Luhn-valid, unique across a batch |
| Reveal once | POST response contains the full number; `GET` list and detail payloads grepped for it and it is absent; drawer state cleared on close |
| Server-side validation | `curl` matrix: missing merchant, zero limit, negative limit, limit > 5,000,000, currency `JPY` — each answered 400; a bypassed client cannot create a bad card |
| State machine | `cards.test.ts` matrix + `curl`: `cancelled → active` answered 409 |
| Tests (stretch) | `npm test` output pasted in the PR |

## Risks

- **Hot-reloaded store lacks the new collections.** The dev server's `globalThis.__northwindStore` predates `cards`. Mitigation: defensive `store.cards ??= …` initialisation, and a dev-server restart before browser verification.
- **Reveal-once vs idempotent replay.** A replayed create must not reveal the number a second time. Mitigation: replay returns the masked record with `replayed: true`; only the first response carries the number.
- **Cross-currency confusion.** A merchant's cards should be in the merchant's own currency; the ticket allows all three. Mitigation: server rejects a currency that does not match the merchant's, and the drawer pre-selects it — stricter than the ticket, called out in the PR.

## Out of scope

- Persistence — NWP-203. The store stays in memory.
- Editing a limit after issue — NWP-202.
- Authentication, roles, real network calls — ticket's own list.

## Open questions

- None blocking. The currency-match rule above is a deliberate tightening; if ops genuinely needs a USD card for a EUR merchant, that is a one-line relaxation in the route.
