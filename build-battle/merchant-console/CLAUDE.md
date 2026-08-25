# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Commands

There is no package.json at the repository root. Run everything from
`build-battle/merchant-console/`.

```bash
npm install
npm run dev        # Next dev server on :3000
npm run build      # production build — also the only full typecheck; there is no `typecheck` script
npm run lint       # eslint-config-next
npm test           # vitest run
npm run test:watch
```

A single file or case:

```bash
npx vitest run src/lib/money.test.ts
npx vitest run -t "groups thousands"
```

Tests are plain Node, no jsdom, and vitest only collects `src/**/*.test.ts`. A test
written as `.test.tsx` is never collected and the suite still passes green.

Imports use the `@/*` → `./src/*` alias; vitest resolves it via `vite-tsconfig-paths`.

## Data lives in memory

Records are generated deterministically at boot — there is no JSON seed file, no database,
and no seed step. `src/data/generate.ts` builds payments, refunds, disputes, and payouts
from a `mulberry32` PRNG seeded `20260813`, so every machine reproduces a bug identically.
Merchants are a TS literal in `src/data/merchants.ts`; Berlin and London are there so
timezone bugs have somewhere to show up.

- `GENERATED_AT` (`2026-08-13T00:00:00.000Z`) is the app's "now". `metrics.ts` and
  `analytics.ts` anchor their buckets to it, not to `Date.now()`. Dashboards showing
  nothing "recent" relative to today's real date is expected.
- The store is held on `globalThis.__northwindStore` so dev-server module reloading does
  not hand each request a fresh copy. Writes last for the life of the process and vanish
  on restart. That is expected.
- Persistence is tracked separately as NWP-203. **Do not add a database, an ORM, or
  migrations.**
- To add records, extend the generator. Never edit seed data to make a failing case
  disappear.

## How a payments request flows

Every list, export, and metric goes through one path:

    page.tsx → GET /api/payments → parseFilters() → queryPayments() → store

- `parseFilters()` (`src/data/queries.ts`) is the allowlist boundary. Route handlers pass
  it the raw `URLSearchParams` and never read params themselves.
- `queryPayments()` = `filterPayments` → `sortPayments` → `paginate`. Call it rather than
  composing the three by hand.
- `GET /api/payments/export` deliberately reuses filter + sort but skips `paginate`, so an
  export covers the full filtered set rather than the visible page.
- `metrics.ts` and `analytics.ts` read `store` directly for aggregates; they do not go
  through the builder.

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
