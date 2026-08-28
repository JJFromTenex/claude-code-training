# SPEC · NWP-101 — Payments export: column and scope options

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** sarangifs@gmail.com
**Status:** reviewed

## Problem

Ops exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and every file comes out identical: every column, current filter only. The card last-four is in all of them, so anything going to a merchant gets cleaned up by hand first. Dana Whitfield's team puts that at 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

- `build-battle/merchant-console/src/app/payments/page.tsx:68` — the Export button is a plain `<a>` inside an async **server** component, pointing at `/api/payments/export?<current filter query>`. No client component, no dialog, no state. The query string is copied verbatim from the page URL, so it carries `page=N`.
- `build-battle/merchant-console/src/app/api/payments/export/route.ts` — calls `parseFilters`, then `filterPayments` + `sortPayments`, and deliberately skips `paginate`. It calls `toCsv(rows)` with no second argument, so all ten columns ship including `last4`. It reads no `columns` or `scope` param. `filters.page` is parsed and then ignored.
- `build-battle/merchant-console/src/lib/csv.ts` — owns `EXPORT_COLUMNS` (ten names), `toCsv(payments, columns = EXPORT_COLUMNS)` and `exportFilename(date = new Date())`. **`toCsv` already accepts a column subset and already emits them in the order given** — `src/lib/csv.test.ts:32` pins that behaviour. The seam exists; nothing calls it.
- `build-battle/merchant-console/src/data/queries.ts:18` — `parseFilters` is the established allowlist boundary. `queryPayments` (line 102) filters, sorts *and paginates*. `PaymentFilters` in `src/data/types.ts` has no `columns` or `scope` field.
- `build-battle/merchant-console/src/components/Drawer.tsx` — the repo's only `@radix-ui/react-dialog` wrapper. There is **no** `Dialog.tsx`, `Checkbox.tsx` or `RadioGroup.tsx` in `src/components/`, and `@radix-ui/react-checkbox` is not a dependency, despite `.claude/rules/components.md` citing "Dialog" as available.
- `build-battle/merchant-console/vitest.config.ts` — `environment: "node"`, `include: ["src/**/*.test.ts"]`. No jsdom, no React Testing Library, and `.tsx` is not matched, so a component test would silently not run.

**Where the ticket does not match the code:** the ticket warns that "building this in the browser exports the current page only, which is the bug we would be shipping." The export is already server-side and already exports all filtered rows. The warning still stands as a trap — routing the new export through `queryPayments` instead of `filterPayments` + `sortPayments` would introduce exactly that bug.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is **integer minor units**. `$250.00` is `25000`." | `merchant-console/CLAUDE.md` | Cents drift on every total |
| "Format at the edge, in the component that renders it, and nowhere else." | `.claude/rules/money.md` | Two formatters disagree |
| "**Validate everything from the client** against an allowlist before it reaches the store, a query, or a filename. Column names, currencies, statuses, sort fields, page sizes." | `.claude/rules/api-routes.md` | Client-supplied text reaches a header or filename |
| "Client-side checks are a convenience, never the enforcement." | `.claude/rules/api-routes.md` | The dialog becomes the only guard |
| "**Reuse the query builder.** Payment filtering goes through the one behind `GET /api/payments`." | `.claude/rules/api-routes.md` | A second filter path drifts from the first |
| "The payments table is paginated. Building this in the browser exports the current page only." | Ticket, notes | The export silently truncates to 20 rows |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name." | `.claude/rules/components.md` | Keyboard and screen-reader users cannot export |
| "Storage and bucketing are UTC." | `merchant-console/CLAUDE.md` | Filenames disagree with the data they hold |

## Approach

`src/lib/csv.ts` already owns `EXPORT_COLUMNS`, so it becomes the export contract: it gains a default column set (everything but `last4`), a parser that turns a client-supplied `columns` string into a validated `ExportColumn[]`, a parser for `scope`, and a scope-aware `exportFilename`. The route composes those with the existing `parseFilters`, rejects an empty column list with a 400, and picks the row set by scope — filters honoured, or an empty filter set through the same builder. It keeps composing `filterPayments` + `sortPayments` rather than `queryPayments`, because skipping `paginate` is the entire point. The Export button moves into a new client component built on the existing `Drawer`, which holds the column and scope state and builds the download URL. Putting the parsers in `src/lib` is deliberate: it is the only place this repo can actually unit-test, since the vitest config is Node-only and does not match `.tsx`.

**Considered and rejected:** doing the selection client-side — fetch the rows the table already has, filter columns in the browser, build a Blob. It is less code and needs no route change, but it exports one page of twenty and makes the client the only validator. That is precisely the bug the ticket says it would be shipping instead of the feature. Also rejected: adding `@radix-ui/react-checkbox` and a centred `Dialog.tsx`. `components.md` says reach for what is here first, `Drawer` is already the Radix dialog, and native `<input type="checkbox">` with a label is correct for keyboard and screen readers without a new dependency.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Default column set, `parseExportColumns`, `parseExportScope`, scope-aware `exportFilename` |
| `src/lib/csv.test.ts` | change | Extend, as the ticket asks — cover the parsers and the filename |
| `src/app/api/payments/export/route.ts` | change | Read and validate `columns` + `scope`; 400 on an empty selection |
| `src/app/payments/export-dialog.tsx` | add | The options dialog, the only new client component |
| `src/app/payments/page.tsx` | change | Swap the `<a>` for the dialog; pass both row counts |

## Plan

1. **Export contract in `src/lib/csv.ts`** — done when: `parseExportColumns(null)` returns nine columns without `last4`, `parseExportColumns("amount,id")` returns `["amount","id"]`, `parseExportColumns("")` returns `[]`, and `exportFilename(date, "disputed")` gives `payments-disputed-<date>.csv`. The nine existing tests still pass.
2. **Route validation and scope** — done when: `curl '…/export?columns=id,bogus,last4'` returns a CSV whose header is `id,last4`, `columns=` alone returns 400 with a JSON message, and `scope=all` ignores an active status filter.
3. **The dialog** — done when: Export opens a drawer with last-four unchecked, the row count changes with scope, and clearing every column disables Download.
4. **Wire it into the page** — done when: `/payments` renders the dialog instead of the bare link, and the filtered count in the drawer matches the "N payments" line on the page.
5. **Extend `src/lib/csv.test.ts`** — done when: `npm test` passes with the new cases and none of the existing ones changed.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; card last-four off by default | Unit: `parseExportColumns(null)` excludes `last4`; browser: the box is unchecked on open |
| Scope current-filter or all, current filter default, row count visible before download | Unit: `parseExportScope` default and allowlist; browser: switch scope and watch the count change, and match the filtered count against the page's "N payments" line |
| Filename reflects scope and date | Unit: `exportFilename(new Date("2026-08-13T…"), "disputed")` → `payments-disputed-2026-08-13.csv`; browser: download with a status filter set |
| Amounts stay minor units, formatted once, currency in its own column | Already true and pinned by `csv.test.ts:33` and `:40`; `toCsv`, `cell` and `escapeCell` are not touched |
| Deselecting every column disables Download | Browser: uncheck all, the button is disabled; and `curl` with `columns=` returns 400, because the client is never the enforcement |
| Column names validated server-side, not interpolated | Unit: unknown names dropped, valid ones kept; `curl` with `columns=id,bogus,last4` echoes no `bogus` |
| Export is not limited to the current page | Filter to more than 20 matches, go to page 2, export, count the rows in the file against the filtered total |
| A unit test covers the column serializer, `npm test` passes | `npm test` summary, in `src/lib/csv.test.ts` as the ticket requires |

## Risks

- **Routing the export through `queryPayments` truncates it to 20 rows.** The composition of `filterPayments` + `sortPayments` is load-bearing; it gets a comment saying why, and the page-2 export check above is there to catch a regression.
- **The filename takes client input.** It never does: the slug is either the literal `"all"` or `filters.status`, which `parseFilters` has already checked against `STATUSES`.
- **Stripping `page` from the export URL.** The route ignores `filters.page` today, so carrying it is inert — but it is a live hazard for anyone who later swaps in `queryPayments`. The dialog drops it.
- **No component test is possible here.** vitest is Node-only and its include glob does not match `.tsx`. Widening it would mean jsdom, React Testing Library and a plugin, which contradicts the config's own stated rationale. The dialog is verified in the browser instead, and everything decidable is pushed into `src/lib` where it can be tested.

## Out of scope

- Persistence of a preferred column set between sessions. The store is in memory; persistence is NWP-203.
- Changing how a cell is written. The ticket is explicit that NWP-101 changes which columns ship, not the escaping or the amount format.
- Adding a raw minor-units amount column. Not asked for, and it would give a file two amount columns that disagree.
- The `sortPayments` amount comparison at `src/data/queries.ts:81` compares `String(a.amount).localeCompare(…)`, so `9000` sorts after `10000`. It predates this ticket and no UI sets `sort`. Worth its own ticket.

## Open questions

- When scope is "current filter" but no status filter is set, the filename has no meaningful slug. This spec falls back to `payments-<date>.csv`, matching today's name. If ops would rather see `payments-filtered-<date>.csv`, that is a one-line change.
