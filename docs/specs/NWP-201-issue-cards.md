# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** srikar
**Status:** reviewed

## Problem

Ops issues virtual cards by messaging the platform team, who create them by hand. It takes hours, happens twelve to twenty times a week, and last month two cards went out with the wrong spend limit because the request lived in a Slack thread. Marcus Bell wants issuing in the console: issue a card, see the cards issued, open one to check it.

## Current state

Cards do not exist yet. Everything below is what the build has to fit into.

- `src/data/types.ts` — `Merchant`, `Payment`, `Refund`, `Dispute`, `Payout`. No `Card`, no `CardStatus`. `Currency` is already `"USD" | "EUR" | "GBP"`, which is exactly the allowlist the ticket asks for.
- `src/data/store.ts:16` — the `Store` interface has five fixed slices, built once at boot and held on `globalThis` so dev-server reloads do not hand out a fresh copy. A `cards` slice has to be added in both the interface and `createStore()`.
- `src/data/generate.ts` — deterministic seed via `mulberry32(SEED)`. **`rand` is one module-level generator shared by every record.** Generating cards *before* the existing payment loop would shift every payment, dispute and payout in the app. Card generation must be appended after `generatePayouts()`.
- `src/data/queries.ts:18` — `parseFilters()` is the house pattern for validating client input against an allowlist; `paginate()` at line 87 is generic over `T` and can be reused for a card list.
- `src/lib/money.ts` — `formatMoney()` for display, `parseAmountToMinorUnits()` at line 46 for turning `"250.00"` into `25000`. The ticket's limit field is exactly this function's job; a second parser would be a defect.
- `src/lib/dates.ts` — `formatDate()` for tables, `formatInZone()` for a merchant's own timezone.
- `src/components/ui/payments/StatusBadge.tsx` — `AnyStatus` is a closed union with three exhaustive `Record` maps (`LABELS`, `DOTS`, `VARIANTS`). Adding `active`/`frozen`/`cancelled` means extending all three or TypeScript fails the build.
- `src/app/payments/[id]/page.tsx` — the detail-page pattern to mirror: `notFound()` on a bad id, a local `Field` component, `Divider` between sections.
- `src/app/payments/export-dialog.tsx` — a working `Drawer`-based dialog with native inputs and real labels, shipped in NWP-101. The issue form should follow it rather than invent a second dialog style.
- `src/components/ui/navigation/AppSidebar.tsx:26` + `src/app/siteConfig.ts:5` — nav is a `navigation` array reading `siteConfig.baseLinks`. A `/cards` entry goes in both.
- **Every existing route handler is a GET.** There is no write-route precedent in the repo, so `POST` and `PATCH` follow `.claude/rules/api-routes.md` rather than a local example.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `CLAUDE.md` | Limits drift; the wrong-limit bug the ticket exists to fix |
| "Every generated number starts `4242` and carries a valid Luhn check digit." | `.claude/rules/cards.md` | A string in this repo could resemble a real PAN |
| "Generate on the server. A card number produced in the browser is a bug." | `.claude/rules/cards.md` | Number generation becomes client-trusted |
| "Reveal once … not on the card record, not in a list or detail payload" | `.claude/rules/cards.md` | Full PAN leaks into every subsequent response |
| "Status is a state machine … Guard the transition on the server, not only in the UI." | `.claude/rules/cards.md` | A cancelled card comes back to life |
| "Validate everything from the client against an allowlist" | `.claude/rules/api-routes.md` | Limit and currency become whatever the client sends |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | Inconsistent errors the UI cannot render |

## Approach

A `cards` slice in the in-memory store, a server-only card module holding the Luhn generator and the state-machine guard, three route handlers (`POST /api/cards`, `GET /api/cards`, `PATCH /api/cards/[id]`), and two pages (`/cards`, `/cards/[id]`) built from the components already in `src/components/`. The full number exists only in the `POST` response body and in the client state of the success screen; the stored record keeps `last4` and a `reference`. Seeded cards give the list something to show and the spend bar something to render.

**Considered and rejected:** deriving spend by linking cards to existing payments. Nothing currently ties a payment to a card, so it means inventing that relationship — real-looking, but not affordable inside 45 minutes, and the ticket only asks for spend *against a limit*.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `Card`, `CardStatus`, `MerchantCategory` |
| `src/data/generate.ts` | change | Seed ~8 cards, appended after `generatePayouts()` so existing records keep their values |
| `src/data/store.ts` | change | `cards` slice on the `Store` interface and `createStore()` |
| `src/lib/cards.ts` | add | Luhn generation on the `4242` BIN, masking, `canTransition()` state machine, limit/currency validation |
| `src/lib/cards.test.ts` | add | Luhn validity, BIN prefix, masking, every legal and illegal transition |
| `src/data/card-queries.ts` | add | `cardById`, `listCards`, `issueCard`, `setCardStatus` — the one place cards are read and written |
| `src/app/api/cards/route.ts` | add | `POST` issues and returns the number once; `GET` lists masked |
| `src/app/api/cards/[id]/route.ts` | add | `PATCH` for freeze/unfreeze/cancel, guarded server-side |
| `src/app/cards/page.tsx` | add | The list: nickname, merchant, masked number, limit, status, created |
| `src/app/cards/[id]/page.tsx` | add | Detail plus spend against limit |
| `src/app/cards/issue-dialog.tsx` | add | Client dialog on `Drawer`, with the one-time reveal success screen |
| `src/app/cards/card-actions.tsx` | add | Freeze/unfreeze without a full page reload (`router.refresh()`) |
| `src/components/ui/payments/StatusBadge.tsx` | change | Extend the three maps with `active`, `frozen`, `cancelled` |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx` | change | `/cards` in nav |

## Plan

Sequenced so each step ends somewhere verifiable.

1. **Types, store slice, seeded cards** — done when: `/payments` still renders and payment ids are unchanged, proving the shared PRNG was not disturbed.
2. **`src/lib/cards.ts` + tests** — done when: `npm test` passes with Luhn, BIN, masking and transition cases green.
3. **`card-queries.ts` + `POST`/`GET /api/cards`** — done when: `curl` issuing a card returns a full number once, and `GET` shows that card masked.
4. **Server-side validation** — done when: `curl` with a missing merchant, a `0` limit, a limit over `5_000_000`, and `currency=JPY` each return 400 with a readable message.
5. **`/cards` list + nav** — done when: the seeded cards render with masked numbers and correct statuses.
6. **Issue dialog + one-time reveal** — done when: issuing in the browser shows the number once, and it is absent after the drawer closes.
7. **`/cards/[id]` detail + spend bar** — done when: a seeded card over 80% renders amber.
8. **`PATCH` + freeze/unfreeze** — done when: the list toggles without a reload, and `curl` on a cancelled card returns 409.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card, appears in list | Browser: submit the dialog, card is at the top of `/cards` |
| Card list with the six columns | Browser: `/cards` against seeded data |
| Card detail with spend against limit | Browser: open a seeded card; bar amber past 80% |
| Numbers on `4242` BIN with valid Luhn | `npm test` — `src/lib/cards.test.ts` |
| Reveal once, mask forever | `curl` the `POST` (full number present), then `GET` list and detail (absent); browser check after closing the drawer |
| Server-side validation | Four `curl` calls, each expecting 400 |
| State machine | `npm test` on transitions, plus `curl` a `PATCH` on a cancelled card expecting 409 |
| Nothing regressed | `npm test` full suite; the pre-push hook re-runs tests and build before the push lands |

## Risks

- **The shared PRNG in `generate.ts`.** Appending card generation is safe; inserting it anywhere earlier silently rewrites every payment in the app. Step 1 checks this explicitly.
- **`StatusBadge`'s exhaustive maps** — a missed entry is a build failure, not a runtime bug. The pre-push hook catches it either way.
- **The 45-minute clock.** Core criteria first; stretch goals in the order listed in step 6–8, dropped from the end if time runs out.

## Out of scope

- Persistence — NWP-203. No database, no ORM, no migration.
- Editing a limit after issue — NWP-202.
- Auth, roles, permissions; real card-network calls.

## Open questions

- Merchant category lock (stretch) has no defined vocabulary in the ticket or the code. If reached, a short fixed list in `types.ts` rather than free text.
