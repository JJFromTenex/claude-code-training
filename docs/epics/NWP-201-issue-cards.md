# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Oleg Ciubotaru
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue a card, see the cards they issued, and open one — in the console, today.

## Current state

Nothing card-shaped exists (`merchant-console/CLAUDE.md`: "Cards is NWP-201 and does not exist yet"). The work is additive; the risk is reimplementing what is already here.

- `src/data/types.ts` — `Currency` is already the `USD | EUR | GBP` allowlist; `Payment.last4` is `string | null`, so last-four-as-string is the established shape. No `Card`.
- `src/data/store.ts:16-22` — five collections on `globalThis.__northwindStore`. Cards is a sixth; writes survive hot reload and vanish on restart (NWP-203).
- `src/data/merchants.ts` — every merchant has a `currency`. The code already knows which currency a card must be in; the ticket does not say so.
- `src/lib/money.ts:16` `formatMoney`, `:47` `parseAmountToMinorUnits` — the one place `"250.00"` becomes `25000`. A second parser is the defect the rubric looks for.
- `src/app/payments/page.tsx` reads `src/data/` directly — pages never fetch their own API, so cards need only a POST and a PATCH. `src/components/Drawer.tsx` is the Radix dialog already in use; the `Dialog` that `components.md` claims does not exist.

**Where the ticket and the code disagree:** detail must show "spend against the limit", but `Payment` has no `cardId`. Decision below.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`." | NWP-201 rule 1 | Limits drift; the 5,000,000 comparison is wrong |
| "Every generated number starts `4242` and carries a valid Luhn check digit." / "Generate on the server." / "`cancelled` is terminal. Guard the transition on the server." | `.claude/rules/cards.md` | A real-looking PAN, a PAN in browser JS, or a PATCH that revives a cancelled card |
| "The full number appears in the creation response and nowhere else … not left in client state after the success screen closes." | `.claude/rules/cards.md` | Reveal-once is a lie |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside `USD`, `EUR`, `GBP`." | NWP-201 core | The wrong-limit incident recurs, in code |

## Approach

Cards become a sixth store collection with one pure module and one data module. `src/lib/cards.ts` owns the Luhn check digit, generation on the `4242` BIN, masking, and the transition table — no store access, so it tests in plain Node. `src/data/cards.ts` owns allowlist validation (including that the currency matches the merchant's), the two writes, an append-only event list per card, and idempotent issuing keyed by a client `Idempotency-Key`. The number is generated inside `issueCard`, returned once from `POST /api/cards`, and never written: `Card` has `last4` and a reference only. UI is the existing Drawer for the form and the reveal, a server-rendered `/cards` table with a client leaf for freeze / unfreeze / cancel, and `/cards/[id]` with a spend bar and history.

**On spend:** `Card.spent` is an integer-minor-units field, `0` for every card issued here; one seeded card carries spend so the bar and the amber threshold are visible. Deriving spend from the merchant's payments was rejected — that is merchant volume, not card spend.

**Considered and rejected:** a new `Dialog` primitive (a duplicate of `Drawer`); `GET /api/cards` routes (nothing consumes them); storing the number encrypted for re-reveal (`cards.md` forbids it).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, `CardEvent`, `Card` — `last4` and `reference`, never a number |
| `src/lib/cards.ts` + `.test.ts` | add | Luhn, `generateCardNumber`, `maskCard`, `canTransition`; tests over many generations and every transition pair |
| `src/data/cards.ts` + `.test.ts` | add | `validateIssueCard`, `issueCard` (idempotent), `transitionCard`; one test per rule |
| `src/data/store.ts`, `generate.ts` | change | `cards` collection, idempotency map, one seeded card |
| `src/app/api/cards/route.ts`, `[id]/route.ts` | add | `POST` validate + issue + reveal once; `PATCH` guarded transition |
| `src/app/cards/page.tsx`, `issue-card.tsx`, `card-actions.tsx`, `[id]/page.tsx` | add | List with empty state, drawer with live minor-units echo and one-time reveal, row actions, detail with amber bar and history |
| `StatusBadge.tsx`, `siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | change | Card statuses join the badge union; Cards in nav and crumbs |

## Plan

1. **`src/lib/cards.ts` + tests** — done when: `npm test` proves 16 digits, `4242`, Luhn valid, and all three moves out of `cancelled` refused.
2. **Types, store, `src/data/cards.ts`** — done when: the store boots with one seeded card and no 16-digit field anywhere.
3. **`POST /api/cards`** — done when: curl gets 400 for no merchant, `0`, `-1`, `5000001`, `250.5`, `JPY`, and GBP on a USD merchant; 201 with the number otherwise; a replayed key gets the same id and no number.
4. **`PATCH /api/cards/[id]`** — done when: `active → frozen → active → cancelled` works and `cancelled → active` is 409 from the server alone.
5. **`/cards` + drawer + reveal** — done when: the number shows once, closing loses it, the row reads `•••• ####`.
6. **`/cards/[id]`** — done when: the 87% seeded card renders amber.
7. **Row actions** — done when: the row flips without a reload and cancel asks first.
8. **`npm test`, `tsc`, `/ship-ready`** — done when: all clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Fill the drawer on `/cards`, submit, see the row |
| Generated numbers | `cards.test.ts` over 500 generations: `4242`, 16 digits, Luhn |
| Reveal once | `curl POST` shows the number; the rendered `/cards` and `/cards/<id>` HTML has no 16-digit run |
| Server-side validation | The curl 400s in step 3 |
| Spend progress | Seeded card at 87% is amber |

## Risks

- **A number surviving in client state.** Closing the drawer must clear it, not hide it.
- **Diff size.** The reviewer reads a bounded window and this file sorts last. Reuse Drawer, StatusBadge, and the helpers; keep the change small.

## Out of scope

- Persistence (NWP-203), editing a limit (NWP-202), auth, real issuer calls.
- `/100` outside a formatter in `src/data/metrics.ts` and `analytics.ts` — pre-existing, noted in the PR.

## Open questions

- No category taxonomy exists in the repo. Using `advertising / software / travel / contractors / utilities` and saying so in the PR.
- The form shows the currency read-only, derived from the merchant, because the server rejects any other value.
