# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

```bash
npm install       # no seed step, no Docker, no database
npm run dev        # start the dev server at localhost:3000
npm run build       # production build
npm run lint       # next lint
npm test           # vitest run — money, date, and CSV helpers, node env, no DOM, <1s
npm run test:watch    # vitest in watch mode
```

Run a single test file directly with vitest, bypassing the `npm test` wrapper:

```bash
npx vitest run src/lib/csv.test.ts
```

Tests live beside the code they cover (`money.ts` / `money.test.ts`, etc.) — there is no separate `test/` tree.

## Data lives in memory

Seed data is JSON, loaded into a store module at boot. Route handlers read and write that store.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, add it to the JSON. Never edit seed data to make a failing case disappear.
- `src/data/generate.ts` seeds deterministically (fixed PRNG, fixed anchor date) so the same bug reproduces the same way on every machine. If you need more data, extend the generator or the JSON rather than randomizing it further.

## Architecture

Every payment-bearing screen and route follows the same shape: a route or page reads request params, hands them to `parseFilters()` for allowlisting, then to the query builder, and never touches `store.payments` directly.

- **`src/data/store.ts`** — the in-memory database. Built once from `generate.ts` + `merchants.ts` and held on `globalThis` specifically so Next's dev-server module reloading doesn't hand a request a fresh, empty copy.
- **`src/data/queries.ts`** — the one query builder. `parseFilters()` is the allowlist boundary (status, sort field, sort direction, page — anything else from the client is dropped to a safe default). `filterPayments()` → `sortPayments()` → `paginate()` compose into `queryPayments()`, which both `GET /api/payments` (the on-screen table) and server components call. **Do not write a second filter/sort implementation** — extend this one.
- **`src/app/api/*/route.ts`** — thin handlers: parse via the allowlist, call the query builder, shape the response. No business logic lives in a route handler.
- **`src/lib/`** — money, date, and CSV are the three places a quiet mistake costs real money or ships a wrong file, which is why each has a colocated `.test.ts`. `formatMoney()` is the only place a decimal point is allowed to appear; everything upstream stays in integer minor units.
- **`src/app/`** — App Router pages. Server components fetch through the query builder and render; interactive pieces (filters, dialogs) are pulled into small `"use client"` components rather than making the whole page client-side.
- **`src/components/`** — Tremor/Radix-based primitives (Button, Select, Dialog, Table, ...) plus console-specific components under `ui/`. Reach for what's here before adding a dependency or hand-rolling a control.
- Path alias `@/*` maps to `src/*` (see `tsconfig.json`); use it instead of relative `../../` imports.

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

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Console routes: overview, payments, disputes, payouts. Cards is NWP-201 and does not exist yet |
| `src/app/api/` | Route handlers |
| `src/data/` | Seed JSON, the in-memory store, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.
