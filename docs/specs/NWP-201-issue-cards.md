# SPEC · NWP-201 · Issue virtual cards from the console

> Written before any code, and reviewed before building.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Gilbert Morgan
**Status:** building

## Problem

Ops issues virtual cards by asking the platform team to create them by hand. It happens
twelve to twenty times a week, it takes hours, and last month two cards were created with
the wrong spend limit because the request lived in a Slack thread. Marcus wants the issue
flow, the list, and the detail view in the console, so the limit is set at the moment the
card exists.

## Current state

Every path below was read before planning.

- `src/data/types.ts` has `Merchant`, `Payment`, `Refund`, `Dispute`, `Payout`, and
  `Currency`. There is no card type.
- `src/data/store.ts` holds an in-memory store on `globalThis`, built once by `createStore`
  from `generate()`. Adding a collection means one field on the `Store` interface.
- `src/data/merchants.ts` carries ten merchants, each with a `currency`. Four are not USD,
  so a merchant and a card can disagree about currency unless something stops them.
- `src/lib/money.ts` has `formatMoney` and `parseAmountToMinorUnits`. The second is the
  boundary parser the issue form needs, so no second one gets written.
- `src/app/api/payments/route.ts` shows the route shape, and `src/data/queries.ts` shows
  the allowlist habit in `parseFilters`.
- `src/components/Drawer.tsx` wraps `@radix-ui/react-dialog` and is the dialog primitive.
  There is no `Dialog.tsx`.
- `src/components/ui/navigation/AppSidebar.tsx` already imports the `CreditCard` icon from
  lucide and never uses it. Navigation entries come from `siteConfig.baseLinks`.
- `src/app/payments/page.tsx` is the model for a server list page with a client child.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units | `CLAUDE.md` | A limit drifts by cents |
| 4242 BIN with a valid Luhn digit | `cards.md` | Something resembles a real PAN |
| Generate on the server | `cards.md` | A browser mints card numbers |
| Reveal once, mask forever | `cards.md` | A full number is re readable |
| Guarded transitions, `cancelled` terminal | `cards.md` | A cancelled card comes back |
| Validate on the server | `api-routes.md` | Client input reaches the store |
| No database, ORM, or migration | ticket | A quality failure, not a bonus |

## Approach

A card lives in the same in-memory store as everything else. The number is generated
server-side, returned once in the creation response, and never written to the record. The
record keeps `last4` only, so masking is a property of the data rather than a rendering
choice.

Status is a guarded transition on the server. The UI offers the transitions that are legal
from the current state, and the route rejects the rest regardless of what the UI sent.

Spend is zero at issue and stays zero. Nothing in this store links a payment to a card, so
any other number would be invented. The progress bar renders that truthfully, and the
threshold logic is unit tested rather than demonstrated with fake data.

**Considered and rejected.** Deriving `spent` from a merchant's existing payments, which
would look better on screen and would be a fabricated link. Also rejected, storing the full
number and masking at render, which is the ordinary way this gets built and is exactly what
the reveal once rule forbids.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `CardCategory`, `CardEvent` |
| `src/data/store.ts` | change | A `cards` collection, empty at boot |
| `src/lib/cards.ts` | add | Luhn, generation, masking, transitions, spend |
| `src/lib/cards.test.ts` | add | Generator, state machine, threshold |
| `src/data/cards.ts` | add | Store reads and writes, and the issue path |
| `src/app/api/cards/route.ts` | add | `GET` list, `POST` issue |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, `PATCH` status |
| `src/app/cards/page.tsx` | add | The list, with an empty state |
| `src/app/cards/cards-table.tsx` | add | Client child, freeze in place |
| `src/app/cards/issue-dialog.tsx` | add | The issue form on `Drawer` |
| `src/app/cards/[id]/page.tsx` | add | Detail, spend bar, history, cancel |
| `src/app/siteConfig.ts` | change | A `cards` link |
| `src/components/ui/navigation/AppSidebar.tsx` | change | The nav entry |

## Plan

1. **Types and store.** Done when a `cards` array exists and the app still builds.
2. **`src/lib/cards.ts` with tests.** Done when a generated number starts `4242`, passes
   Luhn, and the state machine refuses to leave `cancelled`.
3. **Routes.** Done when `POST` returns a number once, `GET` never returns one, and `PATCH`
   refuses an illegal transition.
4. **List and issue dialog.** Done when a card issued in the browser appears, masked.
5. **Detail.** Done when spend, history, and cancel are on the page.
6. **Bug fixes, reported separately.** Done when each has a test that fails without it.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Dialog submits, the card appears in the list |
| Card list | `/cards` renders nickname, merchant, mask, limit, status, date |
| Card detail | `/cards/<id>` renders the record and spend against the limit |
| Generated numbers | Test asserts the `4242` prefix and Luhn over many draws |
| Reveal once | `POST` carries `number`, list and detail bodies do not |
| Server-side validation | Bad merchant, limit, or currency rejected by the route |
| State machine | `PATCH` from `cancelled` refused by the route, not the UI |

## Risks

- A number that fails Luhn would look fine on screen. Mitigated by testing the check digit
  over a range of draws rather than one.
- The full number could leak by being attached to the record for convenience. Mitigated by
  keeping it off the `Card` type entirely, so a leak becomes a type error.
- Freeze from the list could drift from the server's view of status. Mitigated by having
  the route return the updated card and the client render what it returns.

## Out of scope

- Persistence, authentication, real network calls, and editing a limit after issue. The
  ticket names all four.
- Linking payments to cards, which is what an honest non zero `spent` would need.

## Open questions

- None outstanding. Spend semantics were the only real one and are resolved above.
