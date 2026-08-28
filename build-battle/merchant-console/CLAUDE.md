# Northwind Payments — Merchant Console

The internal tool support and ops staff use to look up a payment, refund it, work the dispute queue, and issue virtual cards.

Northwind Payments is fictional. Every merchant, cardholder, amount, and card in this app is generated.

## Run it

Every script below runs from `build-battle/merchant-console/`, not from the repository root where you open Claude Code.

```bash
npm install
npm run dev      # dev server on :3000, redirects to /overview
npm test         # vitest, one pass
npm run lint     # next lint
npm run build    # production build
```

One file, or one test by name:

```bash
npx vitest run src/lib/csv.test.ts
npx vitest run -t "quotes cells containing a comma"
```

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

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | Console routes: overview, payments, disputes, payouts. Cards is NWP-201 and does not exist yet |
| `src/app/api/` | Route handlers |
| `src/data/` | Seed JSON, the in-memory store, and types |
| `src/components/` | Tremor-based primitives and the console's own components |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it. Read these before touching an amount |

`@/*` resolves to `./src/*`.

## How a request actually flows

Worth knowing before you add a route or a page, because the two paths are not the same one.

- **Pages read the store directly.** Console pages are async Server Components that call `queryPayments()` from `src/data/queries.ts` themselves. They do not fetch their own API.
- **`src/app/api/` exists for JSON and file downloads**, not to feed the UI. Adding a route to render a page is the wrong layer.
- **Filter state lives in the URL.** `searchParams` is the state; there is no client store. On `/payments`, `filter-bar.tsx` is the only client component, and all it does is push a new query string.
- **`parseFilters()` is the single validation point.** Route handlers never read search params themselves — they hand them to the query layer, which allowlists them.
- **The export route skips `paginate()` on purpose.** `GET /api/payments` filters, sorts, and paginates; `GET /api/payments/export` filters and sorts and stops there, so a file covers every matching row rather than the visible page. Compare the two before changing either.

## Before you push

Run `npm test`, then `/ship-ready`. The skill checks the rules above, not just formatting.
