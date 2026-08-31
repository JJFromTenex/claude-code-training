# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Claude, with Divyanshu
**Status:** draft

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — hours of turnaround, 12–20 times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread instead of a form. Marcus wants ops to issue, list, and inspect a card themselves, in the console, today.

## Current state

- No card code exists anywhere in this branch. `find src -iname "*card*"` returns only `.claude/rules/cards.md` and display-only references to a *payment's* card brand/last-four (`src/data/types.ts:31-33`, `src/app/payments/page.tsx:122-124`) — nothing to build on, everything to build.
- `src/data/store.ts:16-22` — the `Store` interface has `merchants, payments, refunds, disputes, payouts`. No `cards` array. It's held on `globalThis.__northwindStore` (`store.ts:34-38`) so dev-server HMR doesn't reset it — a new `cards: Card[]` slice needs to live here, seeded empty.
- **Every route handler in this app today is `GET`-only** (`src/app/api/payments/route.ts:4`, `src/app/api/payments/export/route.ts:11`). There is no existing create/mutate route to model — this ticket writes the first one. `.claude/rules/api-routes.md`'s allowlist-everything and same-error-shape rules apply with no sibling code enforcing them yet, so I'm setting the precedent, not following one. (I already set one on NWP-101: a 400 as `{ error: string }`; card routes will match it.)
- `src/data/generate.ts:55,93,110,128,178` — every seeded entity ID is `<prefix>_<zero-padded counter>` (`pay_000001`, `re_000001`, `dp_000001`, `po_0001`). Cards will match: `card_000001`, generated at request time from `store.cards.length + 1` (no extra counter needed, nothing ever deletes a card).
- `src/app/payments/[id]/page.tsx:14-21` is the detail-page model: async server component, `params: Promise<{id}>`, fetch-by-id via a plain function (`paymentById`, not its own API call), `if (!x) notFound()`. `src/app/disputes/page.tsx` is the list-page model: flat table, no filter bar, no pagination — right-sized for card volume.
- `src/components/ui/payments/StatusBadge.tsx:5-50` already keys off a union (`PaymentStatus | DisputeStatus | PayoutStatus`) with three `Record` maps (labels, dot colors, `Badge` variant). Adding `CardStatus` to that union and its three records is a 3-line extension of an existing pattern, not a new component.
- `src/lib/money.ts` (`formatMoney(minorUnits, currency)`) and `src/lib/dates.ts` (`formatDate`, `formatInZone`) are the only formatters to use — **not** `src/lib/utils.ts`'s `formatters.currency`, which takes a float and belongs to the chart/metrics layer, not payment-shaped money.
- No `ProgressBar`/`Meter` component exists in `src/components/` (confirmed by directory listing) — the spend-progress stretch goal has nothing to reuse and will be a small hand-rolled bar, same idiom as `StatusBadge`'s color records.
- No `category`/`mcc` field exists anywhere on `Merchant` (`src/data/types.ts:14-22`, `src/data/merchants.ts`) — the merchant-category-lock stretch goal is a genuinely new field on `Card`, not a hookup to something that already exists.
- Test precedent: only `src/lib/*.ts` pure helpers have `.test.ts` siblings (`vitest.config.ts` runs `src/**/*.test.ts`, node environment, no DOM/`.tsx` support). The Luhn generator and the status-transition guard belong in a new `src/lib/cards.ts` as pure functions, mirroring `src/lib/csv.ts` — that's what makes them testable at all in this setup.
- This branch (`NWP-201-issue-cards`) is cut from `main`, not from the unmerged `NWP-101-export-options` branch — so the `Dialog.tsx` primitive I built for NWP-101 isn't here. It gets recreated fresh (same Radix-Dialog-based centered modal), not merged in, to keep this PR's diff scoped to this ticket.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, converted once at the boundary | `CLAUDE.md`, `money.md`, ticket rule 1 | A `250.00` string stored or compared as-is drifts on every read |
| Never persist a full card number; store last four + a reference | ticket rule 2, `cards.md` | A real-looking PAN sits in memory long after the one-time reveal |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled` (terminal), guarded server-side | ticket rule 3, `cards.md` | A client bug could "unfreeze" a cancelled card |
| Every generated number starts `4242` with a valid Luhn digit | ticket rule 4, `cards.md` | Looks like this repo could ever produce a real-looking PAN |
| Reveal once, mask everywhere else as `•••• 4242` | ticket core criteria, `cards.md` | The number leaks into a list/detail payload after creation |
| Validate on the server: missing merchant, ≤0 limit, limit > 5,000,000, currency outside USD/EUR/GBP | ticket core criteria | A crafted request creates an invalid card the UI would never allow |
| Reuse what's here before adding a component/dependency | `components.md` | A second Dialog or a new npm package for a 3-item toggle |

## Approach

Add a `Card` entity and a `cards: Card[]` store slice; a `src/lib/cards.ts` of pure, tested functions (Luhn generation, masking, the currency/limit allowlist, the status-transition guard); a `src/data/cards.ts` as the single place that reads/writes `store.cards` (list, get-by-id, create, update-status); two route handlers (`POST /api/cards` to issue, `PATCH /api/cards/[id]` to freeze/unfreeze/cancel — the second is a stretch goal); and two pages (`/cards` list, `/cards/[id]` detail) plus an issue-card dialog that shows the generated number exactly once on success.

**Considered and rejected:** letting the client compute the card number or the Luhn digit, since the dialog already has the merchant/limit data in hand and it would save a round trip. Rejected outright — `cards.md` states generation must happen server-side, and a client-generated number is explicitly called out as a bug, not a shortcut.

**Considered and rejected:** tracking `spent` against the limit from a synthetic/random starting value so the progress bar has something to show immediately. Rejected — nothing in scope (no card-network calls, no payment-to-card linkage) produces real spend, and fabricating a number that looks like activity but isn't would be exactly the kind of "looks fine but isn't shippable" the ticket warns about. New cards start at `spent: 0`; the progress bar is real, just usually empty. Flagged again under Risks.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory` (stretch), `Card` interface |
| `src/data/store.ts` | change | add `cards: Card[]` to `Store` and `createStore()`, seeded empty |
| `src/lib/cards.ts` | add | pure functions: Luhn generation/validation, `maskNumber`, `canTransition`, the currency/limit allowlist constants |
| `src/lib/cards.test.ts` | add | unit tests on the Luhn generator and the state machine (named stretch goal) |
| `src/data/cards.ts` | add | `listCards`, `cardById`, `createCard`, `updateCardStatus` — the one place `store.cards` is touched |
| `src/app/api/cards/route.ts` | add | `POST` — validate, create, return `{ card, number }` once |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` — status transition, stretch goal |
| `src/components/ui/payments/StatusBadge.tsx` | change | extend `AnyStatus` + its three records with `CardStatus` |
| `src/components/Dialog.tsx` | add | centered modal primitive (recreated; see Current state) |
| `src/app/cards/page.tsx` | add | list page: nickname, merchant, masked number, limit, status, created date; empty state |
| `src/app/cards/[id]/page.tsx` | add | detail page: full record, spend progress, freeze/unfreeze controls |
| `src/app/cards/issue-card-dialog.tsx` | add | form → success screen showing the number once |
| `src/app/cards/status-actions.tsx` | add | stretch — freeze/unfreeze client island, `router.refresh()` after `PATCH` |
| `src/components/ui/navigation/AppSidebar.tsx` (or wherever nav links live) | change | add a `/cards` nav entry so the route is reachable, not just linkable |

## Plan

1. **Types + store slice** — `Card`/`CardStatus` in `types.ts`, `cards: []` in `store.ts`. Done when: `tsc --noEmit` is clean with the new type unused-but-present.
2. **`src/lib/cards.ts` + tests** — Luhn generator on the `4242` BIN, `maskNumber`, `canTransition`, allowlist constants. Done when: `npm test` passes with new cases for a valid check digit, a rejected bad transition, and an allowed one.
3. **`src/data/cards.ts`** — `listCards`/`cardById`/`createCard`/`updateCardStatus` against `store.cards`. Done when: a scratch script or the route below can create and re-read a card in-process.
4. **`POST /api/cards`** — validate (merchant exists, limit range, currency allowlist, nickname present), call `createCard`, return `{ card, number }`. Done when: `curl -X POST` with a valid body returns 201 with a 16-digit `4242…` number and a masked `card.last4`; an invalid body (bad currency, limit 0, missing merchant) returns 400 with `{ error }`; re-`GET`ting/re-reading the card never includes the number.
5. **`/cards` list page** — flat table off `listCards()`, empty state written. Done when: it renders with zero cards and with cards created via step 4's curl calls.
6. **`/cards/[id]` detail page** — full record, masked number, spend progress (0 for now). Done when: opening a created card shows its data and `notFound()` fires for a bogus id.
7. **Issue-card dialog** — form → `POST` → one-time reveal screen → close → list updates. Done when: issuing a card from the UI makes it appear in the list without a manual refresh.
8. **Stretch, in order**: `PATCH /api/cards/[id]` + freeze/unfreeze UI, amber-past-80% styling on the progress bar, merchant category field + lock, empty/error-state copy pass.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form/dialog, appears in list | Manual: issue one, see it in `/cards` without reload |
| `/cards` list: nickname, merchant, masked number, limit, status, created date | Manual read of the rendered table |
| Card detail: full record + spend vs. limit | Manual: open a card, check every field renders |
| Numbers generated server-side, `4242` BIN, valid Luhn | `src/lib/cards.test.ts` + `curl -X POST /api/cards` inspection |
| Reveal once, mask everywhere else | Manual: number shown once on success; `curl` the list/detail routes after and confirm no full number in the payload |
| Server-side validation (missing merchant, ≤0 limit, >5,000,000, bad currency) | `curl -X POST` with each bad body, expect 400 |
| `npm test` passes | Full suite run before push |

## Risks

- `spent` starting at `0` for every card means the progress bar and the "turns amber past 80%" stretch goal will rarely visibly demonstrate the amber state without a way to move spend — I'll seed one demo card's `spent` value only if I hand-craft it obviously as a demo fixture, not silently.
- First mutating route handler in the app — no existing error-shape/allowlist code to copy exactly; I'm matching `.claude/rules/api-routes.md`'s literal wording and the 400 shape I already used in NWP-101.
- `StatusBadge` lives at `src/components/ui/payments/StatusBadge.tsx` despite now covering cards too — extending in place rather than relocating, to keep the diff small; the path is slightly stale as a result.

## Out of scope

- Persistence, auth, real card-network calls, editing a limit after issue — all explicitly out per the ticket.
- Linking cards to real payment activity or computing real spend — no such flow exists in this codebase yet.

## Open questions

- None blocking — the two modeling calls above (`spent` starts at 0; `Card`'s "reference" to the one-time number is just `card.id`, nothing is stored) are made explicitly rather than left open, since nothing in the ticket or the code contradicts them.
