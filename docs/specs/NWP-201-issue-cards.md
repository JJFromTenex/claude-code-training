# SPEC · NWP-201 — Issue virtual cards from the console

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-201-issue-cards.md`

**Ticket:** [NWP-201](../tickets/NWP-201.md)
**Author:** Ronnie (with Claude)
**Status:** done

## Context

Ops issues virtual cards by asking the platform team over Slack, 12–20 times a week, and two cards last month got the wrong limit. The console needs an issue form, a `/cards` list, and a detail view, built in 45 minutes against the in-memory store. Core criteria carry most of the score; the rules (integer minor units, reveal-once, 4242 BIN + Luhn, server-side state machine) are what make it shippable.

## Current state

- `build-battle/merchant-console/src/data/types.ts` — `Currency = "USD" | "EUR" | "GBP"`, `Merchant` (has `currency`, `timezone`), `Payment` stores `last4` only. No `Card` type.
- `src/data/store.ts` — `Store { merchants, payments, refunds, disputes, payouts }` on `globalThis`; no `cards`. Route handlers write straight to it.
- `src/data/merchants.ts` — `merchants` list and `merchantById(id)`; the merchant allowlist for validation.
- `src/data/queries.ts` — `parseFilters` allowlist pattern; `paymentById`. Payment-only; leave it alone.
- `src/lib/money.ts` — `formatMoney(minor, currency)` and `parseAmountToMinorUnits("250.00") → 25000` (exact, no floats). Both reused; nothing new for money.
- `src/lib/dates.ts` — `formatDate` (tables, UTC) and `formatInZone` (detail, merchant tz). Reused.
- `src/app/api/payments/route.ts` — the route-handler shape (`NextRequest`/`NextResponse.json`). No POST handler exists anywhere yet; the API is GET-only today.
- `src/app/payments/page.tsx` + `[id]/page.tsx` — server components reading the store directly, `TableRoot/Table…`, written empty state, `Field` dl pattern, `StatusBadge`. Templates for `/cards` and `/cards/[id]`.
- `src/app/payments/filter-bar.tsx` — the only client component pattern: `"use client"`, `useRouter`, `Input`, `Select`. No `fetch()` exists in the app yet.
- `src/components/Drawer.tsx` — Radix Dialog wrapper (title, description, focus trap, Escape, close button). `components.md` names a "Dialog"; it does not exist, Drawer is it.
- `src/components/Button.tsx` — `isLoading` prop (disables + spinner), used for duplicate-submit prevention. `Input` has `hasError`; `SelectTrigger` has `hasError`.
- `src/components/ui/payments/StatusBadge.tsx` — `Record<AnyStatus,…>` maps; extend with card statuses rather than a second badge.
- `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx` — nav is a static list; `/cards` must be added to all three.
- `vitest.config.ts` — plain Node, `src/**/*.test.ts`. Tests sit beside the code (`money.test.ts`, `csv.test.ts`).
- Mismatches with the brief: NWP-101 is not implemented on this branch; no `/northwind-pr` skill in `.claude/skills/` (use `/pr`); no pre-push hook is installed (run `npm test` + `npm run lint` manually); `node_modules` is missing in this worktree.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` §1, ticket rule 1 | Limit drift, ORG-STANDARDS #1 violation |
| "Never persist or display a full card number after creation. Store the last four and the generated number's reference." | ticket rule 2, `rules/cards.md`, ORG #8 | PAN leak in store/list/detail/client state |
| "`active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. Guard the transition on the server" | `rules/cards.md`, ticket rule 3 | Cancelled cards come back to life |
| "Every generated number starts `4242` and carries a valid Luhn check digit" | `rules/cards.md`, ticket rule 4 | Something resembling a real PAN |
| "Reject a missing merchant, a zero or negative limit, a limit above 5,000,000 minor units, and any currency outside USD, EUR, GBP. The client is not trusted." | ticket core #6, `rules/api-routes.md` | Wrong limits, the bug this ticket exists to fix |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show" | `rules/api-routes.md` | Unusable form errors |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it" | `rules/components.md` | Inaccessible form, /ship-ready check 7 |
| "Write the empty and error states." | `rules/components.md`, stretch #5 | Blank table on first visit |

## Approach

Add a `Card` record to the store and put every card rule in one testable module, `src/lib/cards.ts`: Luhn check digit, 16-digit generator on the `4242` BIN using `crypto`, the issue-request validator, the transition table, and the mask formatter. Three thin route handlers call it: `POST/GET /api/cards`, `GET /api/cards/[id]`, `POST /api/cards/[id]/status`. Only the POST-issue response carries `number`; the stored record carries `last4` and `numberRef` (an opaque `cnum_…` id). Pages are server components reading the store like `/payments`; the two interactive pieces (issue drawer, freeze/unfreeze/cancel buttons) are small client components that `fetch` the API and call `router.refresh()`, so the list updates without a full reload. Decimal form input is converted with the existing `parseAmountToMinorUnits` on the client and the API accepts integer minor units only.

**Considered and rejected:** Next.js Server Actions for issuance. They would avoid `fetch`, but the ticket and rules are written around route handlers ("validate on the server", "the creation response"), an API is what a grader can curl, and the codebase has no Server Action precedent. Also rejected: seeding cards into the store for the core pass, so the diff stays small; a written empty state covers first visit.

## File map

| File (under `build-battle/merchant-console/`) | Add or change | Why |
| --- | --- | --- |
| `src/data/types.ts` | change | `CardStatus`, `Card { id, nickname, merchantId, spendLimit, spent, currency, last4, numberRef, status, createdAt, updatedAt }` — all money integer minor units |
| `src/data/store.ts` | change | `cards: Card[]` starts empty |
| `src/data/cards.ts` | add | `listCards`, `cardById`, `insertCard`, `applyTransition` — the only store access for cards |
| `src/lib/cards.ts` | add | `luhnCheckDigit`, `isLuhnValid`, `generateCardNumber` (4242 BIN, 16 digits), `CURRENCIES`, `MAX_SPEND_LIMIT`, `validateIssueRequest`, `canTransition`, `maskCard(last4)` |
| `src/lib/cards.test.ts` | add | Luhn vectors, generator (prefix/length/Luhn), validator rejections, transition table incl. cancelled terminal |
| `src/app/api/cards/route.ts` | add | `GET` list (masked), `POST` issue → 400 on validation, 201 with `number` once |
| `src/app/api/cards/[id]/route.ts` | add | `GET` detail, masked; 404 |
| `src/app/api/cards/[id]/status/route.ts` | add | `POST { status }` allowlisted; 404 / 409 on illegal transition |
| `src/app/cards/page.tsx` | add | list table: nickname, merchant, masked number, limit, status, created; empty state; issue button |
| `src/app/cards/issue-card-drawer.tsx` | add | client: Drawer form (labels, `aria-describedby` errors), `isLoading` guard, one-time success screen, clears number on close, `router.refresh()` |
| `src/app/cards/card-actions.tsx` | add | client: Freeze / Unfreeze / Cancel buttons → status route, inline error, `router.refresh()` |
| `src/app/cards/[id]/page.tsx` | add | detail `Field` grid, spend vs limit, progress bar (amber ≥ 80%), actions |
| `src/components/ui/payments/StatusBadge.tsx` | change | add `active`, `frozen`, `cancelled` |
| `src/app/siteConfig.ts`, `src/components/ui/navigation/AppSidebar.tsx`, `Breadcrumbs.tsx` | change | Cards nav link + crumb label |
| `docs/specs/NWP-201-issue-cards.md` | add | this document |

## Plan

0. **Setup** — `git switch -c NWP-201-issue-cards` (from current HEAD, which equals `main`); `npm ci` in `merchant-console`; `npm test` baseline green; write the spec file. Commit `NWP-201: add spec`.
1. **Model + lib + tests** — types, store slot, `src/lib/cards.ts`, `src/data/cards.ts`, `src/lib/cards.test.ts`. Done when: `npm test` passes including new cases (Luhn, 4242 prefix, 16 digits, each rejection, cancelled terminal).
2. **Routes** — the three handlers. Done when: curl `POST /api/cards` returns 201 with `number` starting `4242`; invalid bodies return 400 with a message; `GET /api/cards` and `GET /api/cards/:id` bodies contain no key named `number` and no 16-digit string; status route enforces the table. Read the server diff against the ticket before continuing. Commit `NWP-201: card model, generator, and issuance API`.
3. **UI** — nav, list page, drawer, detail page, StatusBadge. Done when: issuing from `/cards` shows the number once, closing the drawer and refreshing shows only `•••• dddd`, the new row is in the list, detail renders limit and spend. Commit `NWP-201: cards list, issue drawer, and detail`.
4. **Verify core** — tests, lint, tsc, browser walkthrough (form errors, success, mask, detail), API shape inspection. `/ship-ready`, `/pr`, `/submit` (first submission).
5. **Stretch, in order** — (a) transition tests are already in step 1; (b) freeze/unfreeze from the list via `card-actions.tsx` without reload; (c) spend progress bar amber past 80% (needs `spent`; with no spend source it renders 0%, so add 2–3 deterministic seeded cards in `src/data/generate.ts` with `spent` values only if time allows); (d) default the currency to the chosen merchant's currency, and warn when they differ. Commit each, rerun `/ship-ready` and `/submit`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Issue a card | Browser: open `/cards`, fill drawer, submit; row appears after `router.refresh()`. Screenshot. |
| Card list | Browser: columns nickname, merchant, masked number, limit (`formatMoney`), status badge, created (`formatDate`). Empty state text on a fresh server. |
| Card detail | Browser: `/cards/<id>` shows every non-sensitive field and spend vs limit. |
| Generated numbers | `cards.test.ts`: prefix `4242`, length 16, `isLuhnValid` true across 200 generations; curl shows the same. |
| Reveal once, mask forever | curl `GET /api/cards` and `/api/cards/:id` after issuance: no `number` key; browser refresh after closing the drawer shows only mask; `grep -rn "number" src/data/cards.ts` confirms the store never receives it. |
| Server-side validation | `cards.test.ts` for each rejection; curl each invalid body → 400 + message; form shows the message. |
| Status machine (stretch) | `cards.test.ts` table; curl `cancelled → active` → 409. |
| Tests / lint | `npm test`, `npm run lint`, `npx tsc --noEmit` all clean, pasted into the PR. |

Checks actually run get recorded in the PR; anything skipped stays unchecked.

## Risks

- **Full-number leakage** through the store record, a list/detail payload, or client state kept after the success screen. Mitigation: the record type has no `number` field at all; the drawer resets state on close; API shapes are curl-inspected.
- **Float money** if the form converts `"250.00"` itself. Mitigation: only `parseAmountToMinorUnits`, and the API rejects non-integers.
- **State machine enforced only in the UI.** Mitigation: `canTransition` lives in lib, is tested, and is the only path in the status route.
- **`router.refresh()` not re-rendering the server list** in dev. Fallback: a `Link`-based reload is acceptable for core; the no-reload behaviour is a stretch.
- **Clock.** Core (steps 0–4) is targeted at ~30 minutes; stretch only after the first `/submit`.

## Out of scope

- Persistence (NWP-203), limit editing (NWP-202), auth, network calls, merchant category lock (stretch #3, not planned), a second money/date helper, any new dependency.

## Open questions

- Card number length is not stated in the ticket; built as 16 digits.
- Departures during the build: the generator uses the Web Crypto global instead of `node:crypto` because the drawer imports constants from the same module and webpack rejects Node-scheme imports in a client bundle; seeded cards were not added, so `spent` is always 0 and the amber state is built but not exercised.
- Seeding a few cards with spend so the amber bar is demonstrable: deferred to stretch (c), skipped if the clock is tight.
