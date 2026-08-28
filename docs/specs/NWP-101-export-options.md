# SPEC · NWP-101 · Payments export options

> Written before any code, in plan mode rather than with `/spec`, and reviewed before building.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Gilbert Morgan
**Status:** done

## Problem

Ops exports the payments table several times a day for merchant queries, month-end reconciliation, and whatever Finance asks for. The export works but it is fixed, so every column ships every time, including the card last four. Anything going to a merchant is cleaned up by hand first, which Dana's team puts at 3 to 4 hours a month, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

Every claim below was read before building.

- `src/app/payments/page.tsx:46` rebuilds a `URLSearchParams` from every non-empty search param, and lines 68 to 76 render Export as an anchor around that query. No fetch and no client state, so the browser navigates and `content-disposition` turns it into a download.
- `src/app/payments/page.tsx:36-43` builds its `PaymentFilters` by hand instead of calling `parseFilters`, reading only status, merchant, search, and page.
- `src/app/api/payments/export/route.ts:12` calls `parseFilters`, which is the allowlist boundary, then `filterPayments` and `sortPayments`.
- `src/data/queries.ts` holds the one query builder. `queryPayments` ends in `paginate`, which is why the export composes the two lower functions instead.
- `src/lib/csv.ts` owns `EXPORT_COLUMNS`, `cell`, `escapeCell`, `toCsv`, and `exportFilename`. `toCsv` already accepts a column list and `csv.test.ts:32` already tests it.
- `src/components/` has no checkbox, no radio, and no forms plugin. The dialog primitive is `Drawer.tsx`, which wraps `@radix-ui/react-dialog`. `components.md` names a `Dialog` that does not exist.

Measured against the running server before any change. `GET /api/payments` returns 20 rows of 1,658 across 83 pages, while `GET /api/payments/export` returns all 1,658 and `?status=disputed` returns 33.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units | `CLAUDE.md` | Cents drift on every total |
| Storage and bucketing are UTC | `CLAUDE.md` | Totals land on the wrong day |
| One query builder | `.claude/rules/api-routes.md` | Two filter paths disagree |
| Validate on the server against an allowlist | `.claude/rules/api-routes.md` | Client input reaches a query or a filename |
| Use the components that exist | `.claude/rules/components.md` | A second control to maintain |

## Approach

Everything runs on the server. The dialog assembles a URL and nothing more, so no code path can see only the visible page. `csv.ts` gains the column contract, the route validates what arrives and picks the scope, and the page passes both counts down so the dialog can show them without a new endpoint.

**Considered and rejected.** Filtering the chosen columns in the browser, which is the shape the ticket warns about. It would export the current page only, because the table is paginated. Also rejected, adding `@radix-ui/react-checkbox` for the column list, since `components.md` says to reach for what exists before adding a dependency, and a native input styled with Tailwind is enough for one control.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, scope on `exportFilename` |
| `src/lib/csv.test.ts` | change | Cover the column serializer, extending rather than replacing |
| `src/app/api/payments/export/route.ts` | change | Validate `columns` and `scope`, refuse an empty selection |
| `src/app/payments/page.tsx` | change | Read filters through `parseFilters`, pass counts, render the dialog |
| `src/app/payments/export-dialog.tsx` | add | The options dialog |
| `src/components/Drawer.tsx` | change | Name the close button, which had no accessible name |

## Plan

1. **Column contract in `csv.ts`.** Done when `parseExportColumns` drops unknown names, collapses duplicates, keeps the caller's order, and returns nothing for an empty selection.
2. **Tests in `csv.test.ts`.** Done when the new cases pass and the original nine still do.
3. **Route validation and scope.** Done when an empty or fully invalid `columns` returns 400 and `scope=all` ignores the row filters while keeping the sort.
4. **Page wiring.** Done when the page reads `parseFilters` and passes both counts to the dialog.
5. **The dialog.** Done when a column set and a scope produce a working link, and an empty selection disables Download.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns are choosable, last four off by default | `parseExportColumns(null)` excludes `last4`; planted the opposite and one test failed |
| Scope choosable, current filter default, count visible | Dialog reads 33 under the disputed filter and 1,658 for all payments |
| Filename reflects scope and date | `payments-disputed-2026-08-28.csv` and `payments-all-2026-08-28.csv` from the response header |
| Amounts in minor units, formatted once, currency its own column | `Payment.amount` unchanged, `formatMoney` runs once in `cell`, `currency` is a separate case |
| Empty selection disables Download | Disabled button in the dialog, and 400 from the route |
| The file is not the visible page | `?columns=id` returns 1,658 rows and `?page=4` returns the same; swapping to `queryPayments` drops it to 20 |

The last row is the one that matters. A gate nobody has watched fail is not a gate, so the swap to `queryPayments` was performed and reverted rather than reasoned about.

## Risks

- Building any part of the column filtering in the browser would silently export one page. Mitigated by keeping the dialog free of row data and by the count check above.
- Changing `exportFilename` or the default of `toCsv` would break the existing tests, which the test file asks to keep passing. Mitigated by keeping `date` as the first parameter and leaving `toCsv` alone, putting the new default in the route.
- `scope` reaches a filename. Mitigated by allowlisting upstream and stripping anything outside `a-z0-9` inside `exportFilename`, so the property holds on two paths.

## Out of scope

- `src/data/queries.ts:78` sorts amounts as strings, so 25000 orders before 9500. Real, affects an export taken with `sort=amount`, and not this ticket.
- `src/data/metrics.ts:25` buckets daily volume by server local time against UTC keys. Reported in the pull request, and it wants a ticket of its own.
- A shared `Checkbox.tsx` in `src/components/`. Worth doing when a second caller appears.
- Route and dialog tests. `vitest.config.ts` runs in node with no jsdom and collects only `src/**/*.test.ts`, so neither is reachable without changing the test setup.

## Open questions

- Whether the filename scope token should be omitted when no status filter is set. Resolved during planning in favour of always carrying one, so `filtered` covers that case.
