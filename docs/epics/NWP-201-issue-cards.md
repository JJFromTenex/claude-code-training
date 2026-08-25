# EPIC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Oleg Ciubotaru
**Status:** done

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus wants ops to issue a card, see the cards they issued, and open one to check it — in the console, today.

## Current state

Nothing card-shaped exists. `merchant-console/CLAUDE.md` says so: "Cards is NWP-201 and does not exist yet." The work is additive; the risk is reimplementing what is already here.

- `src/data/types.ts` — `Currency` is already the `USD | EUR | GBP` allowlist; `Payment.last4` is `string | null`, so last-four-as-string is the established shape. No `Card`.
- `src/data/store.ts:16-22` — `Store` holds five collections on `globalThis.__northwindStore`. Cards is a sixth; writes survive hot reload, vanish on restart (correct — NWP-203).
- `src/data/merchants.ts` — every merchant has a `currency`. The codebase already knows which currency a card for that merchant must be in; the ticket does not say so.
- `src/lib/money.ts:16` `formatMoney`, `:47` `parseAmountToMinorUnits` — display and the one place `"250.00"` becomes `25000`. A second parser or formatter is the defect the rubric looks for.
- `src/app/api/payments/export/route.ts` — the route-handler shape: parse, delegate to `src/data/`, return. Pages read `src/data/` directly and never fetch their own API (`src/app/payments/page.tsx`), so cards need a POST and a PATCH handler only; list and detail are server components.
- `src/components/Drawer.tsx` — Radix dialog already wrapped, used by `src/app/payments/export-options.tsx` for a form. `components.md` claims a `Dialog` primitive; there is none. The Drawer is the accessible dialog we already have.

**Where the ticket and the code disagree:** the detail page must show "spend against the limit", but `Payment` has no `cardId` — nothing in the store links a payment to a card. Decision in Approach.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. A `$250.00` limit is `25000`. Never a float, never a string with a dollar sign." | NWP-201 rule 1 | Limits drift; the 5,000,000 comparison is wrong |
| "Every generated number starts `4242` and carries a valid Luhn check digit." / "Generate on the server." | `.claude/rules/cards.md` | Something in the repo resembles a real PAN, or the PAN exists in browser JS |
| "The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes." | `.claude/rules/cards.md` | Reveal-once is a lie |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A hand-made PATCH revives a cancelled card |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside `USD`, `EUR`, `GBP`. The client is not trusted." | NWP-201 core | The wrong-limit incident recurs, in code |

## Approach

Cards become a sixth store collection with one pure module and one data module. `src/lib/cards.ts` owns the Luhn check digit, generation on the `4242` BIN, masking, and the transition table — no store access, so it tests in plain Node. `src/data/cards.ts` owns validation against the allowlists (including that the currency matches the merchant's), the two writes (issue, transition), an append-only event list per card, and idempotent issuing keyed by a client-supplied `Idempotency-Key` so a double-click cannot make two cards and a replay cannot re-reveal. The full number is generated inside `issueCard`, returned once from `POST /api/cards`, and never written: `Card` has `last4` and a reference only, so there is no field for a later response to leak. UI is the existing Drawer for the issue form and success screen, a server-rendered `/cards` table with a small client leaf for freeze / unfreeze / cancel, and `/cards/[id]` with a spend bar and history.

**On spend:** `Card.spent` is an integer-minor-units field, `0` for every newly issued card. Three seeded cards carry spend so the detail view and the amber threshold are visible. Deriving spend from the merchant's payments was rejected — that is merchant volume, not card spend, and the UI would state it confidently.

**Considered and rejected:** a new `Dialog` primitive (a duplicate of `Drawer`, ~100 lines of diff for no behaviour); `GET /api/cards` list and detail routes (pages read the store directly, nothing else consumes them); storing the number encrypted for re-reveal (`cards.md` forbids it in as many words).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `CardCategory`, `CardEvent`, `Card` — `last4` and `reference`, never a number |
| `src/lib/cards.ts` | add | Luhn check digit and validator, `generateCardNumber`, `maskCard`, `canTransition`. Pure |
| `src/lib/cards.test.ts` | add | BIN and Luhn over many generations; the full transition matrix |
| `src/data/cards.ts` | add | `validateIssueCard`, `issueCard` (idempotent), `transitionCard`, seed cards, reads |
| `src/data/store.ts` | change | `cards` collection and the idempotency map |
| `src/app/api/cards/route.ts` | add | `POST` — validate, issue, reveal once |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` — server-guarded status transition |
| `src/app/cards/page.tsx` | add | List with the six columns, written empty state, issue drawer, row actions |
| `src/app/cards/issue-card.tsx` | add | `"use client"` — form, live minor-units echo, inline server errors, one-time reveal |
| `src/app/cards/card-actions.tsx` | add | `"use client"` — freeze / unfreeze, cancel behind a confirm, no reload |
| `src/app/cards/[id]/page.tsx` | add | Full record, spend bar (amber ≥ 80%), history |
| `StatusBadge.tsx`, `siteConfig.ts`, `AppSidebar.tsx`, `Breadcrumbs.tsx` | change | Card statuses join the badge union; Cards in nav and crumbs |

## Plan

1. **`src/lib/cards.ts` + tests** — done when: `npm test` proves 16 digits, `4242` prefix, Luhn valid, and every transition pair including all three out of `cancelled` refused.
2. **Types, store, `src/data/cards.ts`** — done when: the store boots with three seeded cards and no card carries a 16-digit field.
3. **`POST /api/cards`** — done when: curl gets 400 for no merchant, `0`, `-1`, `5000001`, `250.5`, `JPY`, and a GBP currency on a USD merchant; 201 with the number for a good body; a replayed `Idempotency-Key` gets the same id with no number.
4. **`PATCH /api/cards/[id]`** — done when: `active → frozen → active → cancelled` works and `cancelled → active` is 409 from the server alone.
5. **`/cards` list + issue drawer + reveal** — done when: issuing in the browser shows the number once, closing loses it, the row reads `•••• ####`.
6. **`/cards/[id]`** — done when: the 87% seeded card renders amber; a 20% one does not.
7. **Freeze / unfreeze / cancel from the list** — done when: the row flips without a reload and cancel asks first.
8. **`npm test`, `npx tsc --noEmit`, `/ship-ready`** — done when: all clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Fill the drawer on `/cards`, submit, see the row |
| Generated numbers | `cards.test.ts` over 500 generations: `4242`, 16 digits, Luhn |
| Reveal once | `curl POST` shows the number; the rendered `/cards` and `/cards/<id>` HTML has no 16-digit run |
| Server-side validation | The curl 400s in step 3 |
| Freeze / unfreeze | Click in the list, row updates, no navigation |
| Spend progress | Seeded card at 87% is amber |
| Empty / error states | `/cards` with no cards reads as written; a bad submit shows the server's message inline |

## Risks

- **A number surviving in client state.** The success screen holds it in React state; closing must clear it, not hide it.

## Out of scope

- Persistence (NWP-203), editing a limit after issue (NWP-202), auth, real issuer calls.
- The lexicographic amount sort at `src/data/queries.ts:81` and `/100` outside a formatter in `src/data/metrics.ts` and `analytics.ts` — pre-existing, noted in the PR, not this ticket.

## Open questions

- No category taxonomy exists in the repo. Using `advertising / software / travel / contractors / utilities` and saying so in the PR.
- The form shows the currency read-only, derived from the merchant, because the server rejects any other value. Cheaper than a select whose only wrong choices are errors.
