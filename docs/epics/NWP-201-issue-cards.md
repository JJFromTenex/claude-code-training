# NWP-201 · Issue virtual cards from the console

## What the codebase already gives us

- `src/lib/money.ts:46` `parseAmountToMinorUnits` — parses a typed dollar string to integer minor units. Reused at the issue-dialog boundary; no second parser.
- `src/lib/money.ts:15` `formatMoney` — reused for spend limit and spend display. No new formatter.
- `src/data/queries.ts` — the payments query builder pattern (`parseFilters` as a server-side allowlist, one query function). `src/data/cards.ts` mirrors it: one `validateIssueCard` allowlist, one write path (`issueCard`/`transitionCard`).
- `src/data/store.ts` — the in-memory store held on `globalThis`. Cards are a fourth array beside `payments`/`refunds`/`disputes`/`payouts`, seeded empty (no fabricated card history — an ops tool that lies about spend is worse than one with none yet).
- `src/components/Drawer.tsx` — Radix-based, already used for nothing yet but exists and is accessible (focus trap, Escape-to-close). Reused for the issue dialog rather than adding a new Dialog primitive, even though `.claude/rules/components.md` claims one exists — it doesn't, on `main`, as of this branch.
- `src/components/ui/payments/StatusBadge.tsx` — mirrored, not extended, into `ui/cards/CardStatusBadge.tsx`, since payment and card statuses are different enums.

## Domain rules (`.claude/rules/cards.md`, `.claude/rules/money.md`, and the ticket)

- Numbers generated server-side, `4242` BIN, valid Luhn check digit, never in the browser.
- Reveal once: the full number appears only in the `POST` response, never on the stored record, never again.
- Status: `active ⇄ frozen`, either → `cancelled`, `cancelled` terminal.
- Spend limits are integer minor units with a currency, same as payments.
- Server-side validation is the only validation that counts; the client's checks are a convenience.

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
| `src/app/siteConfig.ts`, `AppSidebar.tsx` | Nav entry |

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
