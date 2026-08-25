# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

```bash
npm run dev          # start dev server on localhost:3000
npm test             # run all tests (Vitest, node environment, no jsdom)
npm test -- src/lib/csv.test.ts   # run a single test file
npm run lint         # ESLint via next lint
```

No database, no seed step, no Docker.

## Data lives in memory

Seed data is generated deterministically at boot (fixed PRNG seed) and held on `globalThis.__northwindStore` so Next.js hot-reload doesn't reset it. Route handlers read and write that store directly.

- Writes survive the dev session and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- Never edit seed data to make a failing case disappear.

## Where the rest of the context lives

This file loads every session, so it stays short. Detail that only matters once you open a particular kind of file lives in `.claude/rules/` and loads when you do:

| Rule | Applies to |
| --- | --- |
| `money.md` | `src/lib/`, `src/app/api/`, `src/data/` |
| `api-routes.md` | `src/app/api/` |
| `cards.md` | anything card-related |
| `components.md` | `src/components/`, `src/app/` |

## Conventions

These four explain most of the code, and breaking them is how bugs get in here.

1. **Money is integer minor units.** `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge, next to its currency code.
2. **Storage and bucketing are UTC.** Display converts to the merchant's timezone. Nothing else does.
3. **One query builder.** Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut.
4. **Validate on the server.** Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store.

## Card rules

- Generated numbers use the `4242` test BIN and a valid Luhn check digit. Nothing here may resemble a real PAN.
- The full number is returned exactly once, in the creation response. After that, last four only.
- Status is a state machine: `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal.

## Architecture patterns worth knowing

**Rendering model.** All pages are React Server Components by default. The only `"use client"` component on `/payments` is `filter-bar.tsx` (it drives the URL with `useRouter`). New UI that doesn't need browser state should stay as RSC.

**Query pipeline.** Four functions in `src/data/queries.ts` compose in a fixed order: `parseFilters → filterPayments → sortPayments → paginate`. `queryPayments` wraps all four. The export route deliberately skips `paginate` to stream every matching row, not just the current page.

**Test scope.** Only `src/lib/` has tests (money, dates, CSV). Components and route handlers are not unit-tested. When the ticket says "add a test", it means extending an existing `.test.ts` in `src/lib/`, not creating new test infrastructure.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Console routes: overview, payments, disputes, payouts. Cards is NWP-201 and does not exist yet |
| `src/app/api/` | Route handlers |
| `src/data/` | Seed data generator, the in-memory store, types, and the query builder |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

## Release Standards

- All changes require test evidence (passing `npm test` output) before merging.
- No direct commits to `main`. Every change goes through a pull request.
- Every PR description must include a one-line business impact summary.

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.
