# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

```bash
npm install
npm run dev          # dev server, http://localhost:3000
npm run build
npm run lint
npm test              # vitest run — full suite
npm run test:watch
```

Run a single test file: `npx vitest run src/lib/csv.test.ts`
Run tests matching a name: `npx vitest run -t "some test name"`

No database, no seed step, no Docker.

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

## Architecture

Request flow is one straight line, and every layer only talks to the one next to it:

`src/data/generate.ts` seeds payments, refunds, disputes, and payouts once. `src/data/store.ts` holds them in memory — kept on `globalThis` specifically so Next's dev-server module reloading doesn't hand a request a fresh, empty store. Every query and route handler reads and writes that same object.

`src/data/queries.ts` is the query builder referenced throughout this file: `parseFilters` turns request params into an allowlisted `PaymentFilters`, and `filterPayments` → `sortPayments` → `paginate` (composed as `queryPayments`) is the only filtering path. `GET /api/payments` and `GET /api/payments/export` both call into it rather than each filtering independently — extend it rather than adding a parallel one.

`src/lib/csv.ts` is a pure serializer, decoupled from HTTP: `Payment[]` plus a column list in, a CSV string out. The export route currently hardcodes the full column set and exports only the filtered set the query builder returns, not just the visible page.

`src/lib/money.ts` and `src/lib/dates.ts` are the only sanctioned places for currency formatting and timezone conversion — everything upstream of them stays in integer minor units and UTC ISO strings.

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
