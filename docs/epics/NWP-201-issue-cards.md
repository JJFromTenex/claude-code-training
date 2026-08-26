# EPIC · NWP-201 — Issue virtual cards from the console

> The planning this documents happened before any code was written — three Explore agents and one Plan agent verified every claim below directly against the code, and the resulting plan was reviewed before the build started. This file itself was written afterward, once it was confirmed `/epic` doesn't run as a command in this repo (`.claude/skills/*.md` are flat files, missing the `SKILL.md`-in-a-directory format Claude Code discovers) — so it also records what changed during the build and after grading, in Risks, rather than only what was planned going in.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Claude, with Vishal Kulkarni
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — hours of turnaround, 12–20 times a week, and a recent incident where a limit set in a Slack thread came out wrong. Cards are single-merchant, always virtual, and need a spend limit from the moment they exist. Put issuance in the console: issue a card, see every card issued, open one to check it.

## Current state

- `src/data/types.ts`, `src/data/store.ts`, `src/data/generate.ts` — no `Card` type, no `cards` store collection, no card seed data. This is a fully greenfield build.
- `src/app/api/` had exactly two route handlers before this ticket, both `GET` (`payments/route.ts`, `payments/export/route.ts`). No mutation endpoint (`POST`/`PATCH`/`PUT`/`DELETE`) existed anywhere — this ticket introduces the app's first one, and its first `{ message }` error-body convention, since there was no existing precedent to follow.
- `src/app/disputes/page.tsx`, `src/app/payouts/page.tsx` — list pages with no filters read `store.X` directly, no query builder. `src/app/payments/[id]/page.tsx` — the detail-route template: async server component, a `*ById` helper from `queries.ts`, `notFound()` immediately after the fetch, a local `Field` helper rendering a `dl` grid.
- `src/components/ui/payments/StatusBadge.tsx` — an exhaustive `Record<AnyStatus, ...>` keyed by a closed union of payment/dispute/payout statuses, namespaced under `ui/payments/`. Not extensible for a card status without editing a file that isn't card-shaped.
- `src/lib/money.ts`'s `parseAmountToMinorUnits` rejects malformed strings but not zero — bounds checking is the caller's job.
- No `Dialog.tsx` existed in `src/components/` on the branch this was built from (`main`); one was built for a separate, unrelated ticket (NWP-101, payments export) on an unmerged branch.
- `Payment.method`/`cardBrand`/`last4` already mask a *customer's* payment method elsewhere in this app as `{cardBrand} •••• {last4}` — using the payment's own real last four, not a placeholder. This existing in-app convention should have been weighted more heavily during planning than it was (see Risks).

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units | `CLAUDE.md`, `.claude/rules/money.md` | A `$5,000.00` limit stored as a float or string drifts on every comparison |
| Test BIN only, valid Luhn | `.claude/rules/cards.md`, ticket | A generated number that isn't `4242`-prefixed or Luhn-valid resembles a real PAN |
| Reveal once, mask forever | `.claude/rules/cards.md`, ticket | The full number persisted or returned twice is the exact near-miss the ticket describes |
| Status is a state machine | `.claude/rules/cards.md`, ticket | An unguarded transition lets a cancelled card come back to life |
| Validate on the server | `.claude/rules/api-routes.md` | A client-trusted merchant id, limit, or currency reaches the store unchecked |

## Approach

Greenfield addition, dependency-ordered: data layer (`Card` type, `cards: []` in the store, `cardById` in `queries.ts`) → pure helpers (`cardNumber.ts` for generation/Luhn/masking, `cardStatus.ts` for the transition guard) → the mutation routes (`POST /api/cards`, `PATCH /api/cards/[id]`) → UI (a centered `Dialog` primitive, the issue-card dialog with a local reveal-once state, the list and detail pages, freeze/unfreeze from the list).

**Considered and rejected:** seeding `cards` through `generate()` like every other collection — rejected because `generate()` is a deterministic, boot-time-only PRNG seeded for historical fixtures, and a seeded card would have no `fullNumber` to have ever revealed, breaking the "reveal once" concept at the seed layer. Cards are issued at runtime via a real ops action; `cards: []` is initialized directly in `createStore()` instead.

**Considered and rejected:** treating the mask as the literal constant `"•••• 4242"` (the BIN) rather than each card's own real last four. This reading came from the ticket's and `cards.md`'s repeated example text, and was deliberately chosen and confirmed during planning — but it was wrong. The grader caught it, and in hindsight the existing in-app precedent (`Payment.last4` masking a customer's real digits) should have settled the question before it was ever asked. Fixed post-grading: `maskCardNumber()` now derives from the actual generated number.

**Added post-grading, not in the original plan:** a card's currency now always matches its merchant's own currency (`merchants.ts` already carries one `currency` per merchant — 6 USD, 2 EUR, 2 GBP in the seed data). The issue dialog derives currency from the selected merchant and displays it read-only rather than offering an independent choice; the route enforces the same match server-side, since the client's derived value is still just a client value. This wasn't asked for anywhere in the ticket text, and is a real product assumption (a merchant might conceivably want a card in a different currency, e.g. to pay a foreign vendor) rather than an obvious correctness fix — flagged here and in the PR rather than treated as self-evidently correct.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | Add `CardStatus`, `Card` | The core entity; no prior art existed |
| `src/data/store.ts` | Add `cards: Card[]`, initialized empty | Runtime-issued, not seeded |
| `src/data/queries.ts` | Add `cardById` | Matches `paymentById`'s single-record lookup precedent |
| `src/lib/cardNumber.ts` | New | Generation, Luhn check/validate, masking — isolated and independently testable |
| `src/data/cardStatus.ts` | New | The transition allowlist, built even though only the stretch PATCH route calls it — it's a hard rule, not stretch |
| `src/lib/money.ts` | Add `CURRENCIES` | First runtime currency list in the app; needed for the currency `<Select>` and route validation |
| `src/app/api/cards/route.ts` | New `POST` | Validates merchant/limit/currency, generates the number, returns it exactly once |
| `src/app/api/cards/[id]/route.ts` | New `PATCH` (stretch) | Guards freeze/unfreeze/cancel server-side via `canTransitionCardStatus` |
| `src/components/Dialog.tsx` | New (copied verbatim from the unmerged NWP-101 branch) | Avoids a second dialog implementation; identical content means zero conflict whichever PR merges first |
| `src/components/ui/cards/CardStatusBadge.tsx` | New | Sibling to `StatusBadge`, not an edit to a payments-namespaced file |
| `src/app/cards/issue-card-dialog.tsx` | New, client | Form → POST → local reveal-once state, reset on close |
| `src/app/cards/page.tsx` | New | List, read `store.cards` directly (no filters, matching disputes/payouts) |
| `src/app/cards/[id]/page.tsx` | New | Detail, mirrors the payment detail page's structure |
| `src/app/cards/status-action.tsx` | New, client (stretch) | Freeze/unfreeze from the list row, no page reload |
| `src/components/ui/cards/SpendProgress.tsx` | New (stretch) | Amber past 80%; `spent` never moves in this app, so the amber branch is unit-tested, not click-tested |
| `src/app/cards/[id]/not-found.tsx` | New (stretch) | The whole app relied on Next's generic 404 before this; cards gets a specific one |
| `src/app/siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | Edit | Nav wiring, matching the existing pattern for every other section |

## Plan

1. **Data layer** — types, store, `cardById`, `CURRENCIES`. Done when `tsc --noEmit` is clean with no card UI yet.
2. **Pure helpers** — `cardNumber.ts`, `cardStatus.ts`. Done when hand-computed Luhn fixtures match by direct Node evaluation, before any test file exists.
3. **`POST /api/cards`** — done when all four required rejections return `400` with the right message via `curl`, and a valid request returns `201` with the full number only outside the `card` object.
4. **UI** — dialog, list, detail. Done when a card issued through the real dialog appears in the list masked, and the reveal screen shows the full number exactly once.
5. **Stretch** — tests, PATCH route, freeze/unfreeze UI, spend bar, cards-specific 404. Done when `npm test` passes and every transition case is verified via `curl`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Issued through the actual dialog in-browser; appeared in the list without a manual refresh |
| Card list | `/cards` shows nickname, merchant, masked number, limit, status, created date |
| Card detail | `/cards/[id]` shows the full record plus `spent`/`limit` |
| Generated numbers | `cardNumber.test.ts` — hand-computed fixtures plus a 50-iteration property test |
| Reveal once, mask forever | Confirmed via `curl` that `fullNumber` never appears inside the `card` object; confirmed the dialog's local state resets on close |
| Server-side validation | Five `curl` cases: bad merchant, zero limit, negative limit, over-limit, bad currency — each `400` |
| Freeze/unfreeze (stretch) | `curl` through all 9 `(from, to)` pairs; browser check that the list updates with no navigation |

## Risks

- The masked-number defect above shipped to the first graded pass. Root cause: two ambiguous prose mentions were weighted over an existing, working in-app convention (`Payment.last4`) that should have settled the question. Lesson for next time: when the codebase already answers a question the ticket text leaves ambiguous, the codebase wins.
- `spent` is always `0` — the detail page and progress bar are honest about that, but it means the progress bar's amber-past-80% behavior is only verified by unit test, never by clicking through the running app, since nothing in this app can move `spent`.

## Out of scope

- Persistence (NWP-203), auth/roles, real card-network calls, editing a limit after issue (NWP-202) — all per the ticket.
- Merchant category lock (stretch) — would mean inventing a category taxonomy the ticket doesn't specify, with no spend-restriction engine to enforce it against yet.

## Open questions

- None outstanding. Two were raised and resolved during planning: how to model `spend` with no transaction engine (resolved: always `0`, never simulated), and whether the mask was a literal constant or per-card (resolved incorrectly at the time — see Risks — and fixed after grading).
