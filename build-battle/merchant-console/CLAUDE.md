# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Run it

```bash
npm install
npm run dev
```

No database, no seed step, no Docker.

## Commands

```bash
npm run dev      # dev server, http://localhost:3000
npm run build    # production build
npm run start    # run the production build
npm run lint     # eslint
npm test         # vitest run — full suite, run before every push
npm run test:watch
```

Run a single test file or a name filter directly with vitest, bypassing the `test` script:

```bash
npx vitest run src/lib/csv.test.ts
npx vitest run -t "formats amounts"
```

Tests are Node-environment, no jsdom (`vitest.config.ts`) — everything under test is money math, date bucketing, and serialization, none of which needs a DOM.

## Architecture

A request for payment data crosses four layers, in the same order whether it's a page load, the JSON API, or the CSV export:

1. **`src/app/**`** — App Router pages (server components) and `src/app/api/**` route handlers. Neither owns filtering logic; both call into `src/data/queries.ts`.
2. **`src/data/queries.ts`** — the one query builder. `parseFilters()` allowlists every value from the client (status, sort, direction, page, …) before anything downstream sees it; `filterPayments()` / `sortPayments()` / `paginate()` do the actual work and are shared by the payments table, `GET /api/payments`, and `GET /api/payments/export`.
3. **`src/data/store.ts`** — the in-memory array those functions read from, generated once at boot by `src/data/generate.ts` and pinned to `globalThis` so Next's dev-server module reloads don't hand out a fresh copy.
4. **`src/lib/**`** — pure formatting helpers (`money.ts`, `dates.ts`, `csv.ts`) called at the edge, once, when a value is about to be displayed or serialized. Nothing upstream of this layer formats a value.

Route-scoped detail beyond this (validation specifics, card state machine, component conventions) lives in `.claude/rules/*.md` and loads automatically when you open a matching file — see the table below.

## Data lives in memory

Seed data is JSON, loaded into a store module at boot. Route handlers read and write that store.

- Writes last for the life of the dev server and vanish on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or migrations.**
- If you need more seed data, add it to the JSON. Never edit seed data to make a failing case disappear.

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
