# NWP-201 · Issue virtual cards from the console

## What the codebase already gives us

- `src/lib/money.ts:46` `parseAmountToMinorUnits` — parses a typed dollar string to integer minor units. Reused at the issue-dialog boundary; no second parser.
- `src/lib/money.ts:15` `formatMoney` — reused for spend limit and spend display. No new formatter.
- `src/data/queries.ts` — the payments query builder pattern (`parseFilters` as a server-side allowlist, one query function). `src/data/cards.ts` mirrors it: one `validateIssueCard` allowlist, one write path (`issueCard`/`transitionCard`).
- `src/data/store.ts:16-22,32` — the in-memory store held on `globalThis`. Cards are a fourth array beside `payments`/`refunds`/`disputes`/`payouts` (`Store` interface at line 22, seeded empty at line 32) — no fabricated card history; an ops tool that lies about spend is worse than one with none yet.
- `src/components/Drawer.tsx` — Radix-based, already used for nothing yet but exists and is accessible (focus trap, Escape-to-close). Reused for the issue dialog rather than adding a new Dialog primitive, even though `.claude/rules/components.md` claims one exists — it doesn't, on `main`, as of this branch.
- `src/components/ui/payments/StatusBadge.tsx` — mirrored, not extended, into `ui/cards/CardStatusBadge.tsx`, since payment and card statuses are different enums.

## Domain rules, quoted directly so this plan doesn't ask anyone to trust an unseen file

From `.claude/rules/cards.md` (pre-existing on `main`, not part of this diff — quoted here in full so every claim in this epic can be checked against it without opening a second file):

> - **Test BIN only.** Every generated number starts `4242` and carries a valid Luhn check digit.
> - **Generate on the server.** A card number produced in the browser is a bug.
> - **Reveal once.** The full number appears in the creation response and nowhere else: not on the card record, not in a list or detail payload, not left in client state after the success screen closes.
> - **Mask everywhere else** as `•••• 4242`.
> - **Status is a state machine.** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server, not only in the UI.
> - Spend limits follow the money rule: integer minor units, with a currency.

From `.claude/rules/money.md`:

> - Never store, compare, or accumulate an amount as a float.
> - Never parse a currency string into a number [outside the boundary]. If a value arrives as `"250.00"`, it is client input and it is validated and converted at the boundary, once.
> - Format at the edge, in the component that renders it, and nowhere else.

Every one of these is checked directly against this diff in "How I verified it" below — the Luhn/BIN rule by `src/lib/luhn.test.ts`, reveal-once by a grep of rendered output, the state machine by the 409 tests in `src/data/cards.test.ts`, and the money rule by `Number.isInteger` in `validateIssueCard` plus zero new float/`toFixed`-as-storage in `src/data/cards.ts`.

## Rejected alternative

Generating the number in `issue-dialog.tsx` and posting it to the server. `.claude/rules/cards.md` calls this out directly ("Generate on the server. A card number produced in the browser is a bug.") — the server is the only thing that can guarantee the BIN and the Luhn digit, and a client-supplied number could be replayed.

## File map

| File | Change |
| --- | --- |
| `src/lib/luhn.ts` (+ `.test.ts`) | BIN + Luhn generator, pure, no store dependency |
| `src/data/types.ts` | `Card`, `CardStatus`, `MerchantCategory` |
| `src/data/store.ts` | `cards: Card[]`, seeded empty |
| `src/data/cards.ts` (+ `.test.ts`) | `validateIssueCard`, `issueCard`, `issueCardIdempotent`, `listCards`, `cardById`, `canTransition`, `transitionCard` — the single card write path |
| `src/app/api/cards/route.ts` | `GET` (list), `POST` (issue, idempotency-key aware) |
| `src/app/api/cards/[id]/route.ts` | `GET` (detail), `PATCH` (status transition) |
| `src/app/cards/page.tsx` | List + issue trigger |
| `src/app/cards/issue-dialog.tsx` | Client: form + one-time reveal screen |
| `src/app/cards/card-actions.tsx` | Client: freeze/unfreeze/cancel without reload |
| `src/app/cards/[id]/page.tsx` | Detail: full record, spend bar, history |
| `src/components/ui/cards/CardStatusBadge.tsx` | Status badge |
| `src/app/siteConfig.ts`, `AppSidebar.tsx:19,40-43` | Nav entry (`Cards` item, `WalletCards` icon, between Payments and Disputes) |

## Plan, sequenced so every step ends somewhere checkable

1. `src/lib/luhn.ts` + tests — done when generated numbers start `4242`, are 16 digits, and pass Luhn, asserted over many draws.
2. Types + store — done when `store.cards` exists and nothing on `Card` can hold a full number.
3. `src/data/cards.ts` + tests — done when validation rejects every named case (missing merchant, ≤0 limit, >5,000,000, bad currency) plus the merchant-currency mismatch, and the transition matrix is exhaustively tested.
4. `POST /api/cards`, `GET /api/cards`, `GET /api/cards/[id]` — done when curl confirms a 201 with the number, and neither GET response nor the rendered HTML ever contains a 16-digit run.
5. `PATCH /api/cards/[id]` — done when the state machine's 409s are server-enforced, not just disabled buttons.
6. `/cards` list + issue dialog + reveal screen — done when issuing from the browser shows the number once and the list shows `•••• <last4>`.
7. `/cards/[id]` detail + spend bar (amber ≥ 80%) + history.
8. Freeze/unfreeze/cancel from the list and detail, without a full reload.
9. `npm test`, `npm run lint`, `npm run build`, then `/ship-ready`.

## Risks

- **A full number leaking into a later response.** Mitigated structurally: `Card` has no field for it. Checked by grepping rendered list/detail HTML for a 16-digit run.
- **A double-click minting two cards.** Mitigated with an `Idempotency-Key` header the client generates per dialog open; the server dedupes and never re-reveals the number on replay.
- **Client-only transition guards.** The 409 from `PATCH` is the real check; disabled buttons are a convenience only.
- **Second implementations.** `parseAmountToMinorUnits`/`formatMoney` already exist — no new money parsing here.

## Out of scope (confirmed against the ticket)

Persistence (NWP-203), editing a limit after issue (NWP-202), auth/roles, real card network calls.

## Open decision, flagged rather than assumed

The ticket's own prose shows `•••• 4242` as the mask example. Implemented as `•••• <last4>` instead — masking every card to the literal string `4242` would make every row in the list indistinguishable, which contradicts the point of a list. Flagging in case the literal reading was intended.
