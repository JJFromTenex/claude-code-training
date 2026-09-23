# Northwind Payments — Merchant Console

The internal tool Northwind's support and ops teams use to look up a payment, refund it, and work the dispute queue.

**Northwind Payments is fictional.** Every merchant, cardholder, amount, and dispute in this app is generated. Nothing here is real payment data, and nothing here is a real company.

## Run it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No database, no seed step, no Docker.

## Test it

```bash
npm test
```

Vitest, node environment, no DOM. The suite covers the money, date, and CSV
helpers — the three places a quiet mistake costs real money. It runs in under
a second, which is the point: it is meant to run before every push.

Data lives in an in-memory store, generated deterministically at boot by `src/data/generate.ts`. Anything you create lasts for the life of the dev server and resets on restart. That is deliberate — see [`CLAUDE.md`](./CLAUDE.md).

## The rules of this codebase

Read [`CLAUDE.md`](./CLAUDE.md) before writing code. The short version:

1. **Money is integer minor units.** Cents, not dollars. Never a float. Format once, at the edge, next to its currency.
2. **Storage and bucketing are UTC.** Display converts to the merchant's timezone. Nothing else does.
3. **One query builder.** Payment filtering goes through the one behind `GET /api/payments`.
4. **Validate on the server.** Nothing that arrives from the client is trusted.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app/` | The console routes: overview, payments, disputes, payouts |
| `src/app/api/` | Route handlers. The query builder behind `GET /api/payments` is the one to reuse |
| `src/components/` | Tremor-based UI primitives and the console's own components |
| `src/data/` | Seed generator, the in-memory store, the query builder, and types |
| `src/lib/` | Money, date, and CSV helpers, each with a `.test.ts` beside it |

## Your ticket

Tickets live at the repository root in [`docs/tickets/`](../../docs/tickets/). Pull one into context rather than retyping it:

```
@docs/tickets/NWP-101.md
```

## Attribution

Built on [`tremorlabs/template-planner`](https://github.com/tremorlabs/template-planner) by Tremor Labs, Inc., used under the MIT License. See [`LICENSE.md`](./LICENSE.md) for the license and [`NOTICE`](./NOTICE) for the list of changes.
