# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Build Battle session
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand — hours of turnaround, 12-20 times a week, and a wrong-limit incident last month because the request lived in a Slack thread. Marcus wants issuance in the console today: a form that creates a card, a list of what's been issued, and a detail view to check one.

## Current state

- `src/data/types.ts` has no `Card` type. `Payment` has no relationship to a card — cards are a new, independent entity for this ticket.
- `src/data/store.ts` holds the in-memory `Store` (`merchants`, `payments`, `refunds`, `disputes`, `payouts`) on `globalThis`. Adding `cards: Card[]` follows the same shape.
- `src/data/generate.ts` seeds `Payment.last4`/`cardBrand` with a placeholder 4-digit string — it never generates or validates a real card number. No Luhn logic exists anywhere in the repo yet.
- `src/lib/money.ts` has `formatMoney`, `formatMoneyCompact`, and `parseAmountToMinorUnits` — the last one is exactly the boundary converter a limit-entry form needs.
- `src/app/payments/page.tsx` + `src/app/payments/[id]/page.tsx` are the pattern to mirror: server components reading straight from the data layer (`queryPayments`, `paymentById`), no client fetch for render.
- `src/app/api/payments/route.ts` and `.../export/route.ts` are the only two payments routes, both existing because something needs a URL (JSON caller, file download). Cards need the same reasoning: a URL is only justified where a client component must call one.
- `src/components/Drawer.tsx` is a fully wired Radix dialog (focus trap, labeled, Escape-to-close, its own header/close button) that nothing currently uses for card issuance — reusing it avoids building a second dialog primitive.
- `src/components/ui/payments/StatusBadge.tsx` maps `PaymentStatus | DisputeStatus | PayoutStatus` to a badge. `CardStatus` is a different lifecycle (`active/frozen/cancelled` vs. captured/refunded/etc.) — a small sibling component in `ui/cards/` keeps this ticket's diff out of `StatusBadge.tsx`.
- `src/app/siteConfig.ts` + `src/components/ui/navigation/AppSidebar.tsx` + `.../Breadcrumbs.tsx` are where `/payments`, `/disputes`, `/payouts` are registered — `/cards` needs the same three touch points.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, converted once at the boundary | `CLAUDE.md`, ticket rule 1 | A `$250.00` limit stored as `250` or `250.00` corrupts every comparison against it |
| Never persist or display a full card number after creation | ticket rule 2 | A re-readable full PAN anywhere is the exact incident this ticket exists to prevent |
| Status is a state machine: `active ⇄ frozen`, either → `cancelled` (terminal) | ticket rule 3 | An unguarded PATCH lets a cancelled card "reactivate" |
| Numbers generated server-side, `4242` BIN, valid Luhn check digit | ticket rule 4, `.claude/rules/cards.md` | A client-generated or non-Luhn number could resemble a real PAN |
| Validate on the server against an allowlist | `.claude/rules/api-routes.md` | A bad merchant id, limit, or currency reaches the store |

## Approach

Add a `Card` entity alongside the existing domain types, generated and mutated entirely server-side. One route (`POST /api/cards`) creates a card and returns the full number exactly once in that response body; the store only ever holds `last4`. A second route (`PATCH /api/cards/:id`) enforces the status state machine for freeze/unfreeze/cancel, called from a small client component so the list/detail can update without a full page reload. The list and detail pages are server components reading straight from a new `src/data/cards.ts` data layer, matching the payments pattern exactly. The issue form lives in a `Drawer`, and its success state (the one-time number reveal) replaces the form inside the same drawer rather than navigating away, so the reveal is unmissable and un-repeatable.

**Considered and rejected:** modeling spend as randomly-generated historical transactions against each card, so the progress bar has something to show immediately. Rejected — there is no payment-to-card relationship in this domain model, and fabricating transaction history is out of scope and dishonest about what the feature actually does. Spend starts at `0` for every card; the field and the bar are real and wired, they just have nothing to show yet because nothing has spent against a card issued five minutes ago. Noted as a limitation in the PR, not hidden.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | Add `CardStatus`, `Card` |
| `src/lib/cardNumber.ts` | add | Luhn generator + validator, server-only |
| `src/lib/cardNumber.test.ts` | add | Stretch: BIN, length, Luhn validity, uniqueness |
| `src/data/store.ts` | change | Add `cards: Card[]` to `Store` |
| `src/data/cards.ts` | add | `listCards`, `cardById`, `parseCardInput` (allowlist validation), `createCard`, `setCardStatus` (state machine), category allowlist |
| `src/data/cards.test.ts` | add | Stretch: status transitions, validation rules |
| `src/app/api/cards/route.ts` | add | `POST` — validate, generate, store, return `{ card, number }` once |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` — status transition only, server-guarded |
| `src/components/ui/cards/CardStatusBadge.tsx` | add | Badge for `active/frozen/cancelled` |
| `src/app/cards/page.tsx` | add | List: nickname, merchant, masked number, limit, status, created |
| `src/app/cards/[id]/page.tsx` | add | Detail: full record, spend bar |
| `src/app/cards/issue-card-dialog.tsx` | add | Client: form → submit → one-time reveal, in a `Drawer` |
| `src/app/cards/card-status-actions.tsx` | add | Client: freeze/unfreeze/cancel, no reload |
| `src/app/cards/spend-bar.tsx` | add | Stretch: progress bar, amber past 80% |
| `src/app/siteConfig.ts` | change | Add `baseLinks.cards` |
| `src/components/ui/navigation/AppSidebar.tsx` | change | Nav entry |
| `src/components/ui/navigation/Breadcrumbs.tsx` | change | Label for `/cards` segment |

## Plan

1. **Types + Luhn generator** — done when: `Card`/`CardStatus` exist and `cardNumber.test.ts` passes (`npm test`).
2. **Data layer** (`store.ts`, `cards.ts`, its tests) — done when: `cards.test.ts` passes, covering both validation and every legal/illegal status transition.
3. **Routes** — done when: a `curl POST` returns a card + 16-digit Luhn-valid number once, a bad body returns 400 with field errors, and `curl PATCH` enforces the state machine (`cancelled` → anything is rejected).
4. **List + detail pages, nav wiring** — done when: `/cards` and `/cards/[id]` render against real store data with no client fetch for the initial render.
5. **Issue dialog** — done when: submitting the form creates a card, shows the number once, and the list reflects it without a manual refresh.
6. **Status actions + spend bar** — done when: freeze/unfreeze updates the badge in place, and the bar exists and turns amber past 80% (even if currently always 0%).
7. **`npm test`, ship-ready pass, `/pr`** — done when: suite is green, checks below all pass, PR description is written.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card via form | Manual: fill form in `/cards`, submit, see it in the list |
| Card list at `/cards` | Manual: all six fields visible per row |
| Card detail | Manual: open a card, see full record + spend row |
| Server-side generated numbers, `4242` + Luhn | `cardNumber.test.ts`; inspect `POST` response |
| Reveal once, mask forever | Manual: refresh `/cards`, refresh detail — number never reappears; grep confirms nothing stores it |
| Server-side validation | `cards.test.ts` + `curl` with a bad merchant/limit/currency, expect 400 |

## Risks

- No payment-to-card link exists, so "spend against the limit" is real infrastructure with a `0` value today — flagged above, not hidden.
- Time budget: routes and data layer first; if the clock runs out, list + detail (core) outrank the dialog's polish and every stretch goal.

## Out of scope

- Persistence, auth, real card network calls, editing a limit after issue — per the ticket.
- Linking cards to actual payment spend — no domain relationship exists yet; would need its own ticket.

## Open questions

- None blocking. Category lock (stretch) uses a small fixed allowlist (`advertising`, `software`, `travel`, `office_supplies`, `other`) since the ticket doesn't specify one.
