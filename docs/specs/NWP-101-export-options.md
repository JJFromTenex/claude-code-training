# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Manali Kamalaskar
**Status:** draft

## Problem

Ops exports the payments table several times a day (merchant queries, month-end reconciliation, Finance requests), but the export is fixed: every column, current filter only, no choice. The card last-four is in every file, so anything sent to a merchant has to be hand-edited first. Dana's team spends 3 to 4 hours a month on that cleanup, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

What the code does today. Every claim carries a file path.

- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?{query}">`, where `query` is the active filter params. No dialog, no options. The page already computes `total` for the current filter via `queryPayments(filters)` at `:45`.
- `src/app/payments/filter-bar.tsx` — client component that writes `status`, `merchantId`, and `search` into the URL. Those same params ride the export link.
- `src/app/api/payments/export/route.ts` — `GET` handler. Calls `parseFilters` then `filterPayments` and `sortPayments`, and returns `toCsv(rows)` with a `content-disposition` filename from `exportFilename()`. Column set and scope are both hard-coded to the defaults.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` (10 columns, **including `last4`**), the `ExportColumn` type, `toCsv(payments, columns = EXPORT_COLUMNS)` which **already accepts a column subset and preserves order**, and `exportFilename(date = new Date())` producing `payments-YYYY-MM-DD.csv`. Amounts are formatted once here via `formatMoney`, and `currency` is already its own column.
- `src/data/queries.ts` — the one query builder: `parseFilters` (allowlists status/sort/direction at `:18`), `filterPayments`, `sortPayments`, and `queryPayments` returning `{ rows, total, page, pageCount, pageSize }`.
- `src/lib/csv.test.ts` — already covers `toCsv` column subsets, escaping, and `exportFilename` (pins `payments-2026-03-14.csv`). The ticket says extend this file.

**Contradictions with the ticket / rules, flagged:**
- `.claude/rules/components.md` says a `Dialog` primitive exists. It does not. `src/components/Drawer.tsx` is the only component built on `@radix-ui/react-dialog`; there is no `Dialog.tsx`.
- There is **no Checkbox component** and no checkbox dependency installed. Column selection needs one built from native inputs.
- Two ACs are already met by the current code: amounts stay in minor units and format once (`csv.ts` via `formatMoney`), and `currency` is already a separate column.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate everything from the client against an allowlist before it reaches the store, a query, or a filename. Column names, currencies, statuses, sort fields." | `.claude/rules/api-routes.md` | Client-chosen columns reach a filename or serializer unchecked |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut." | `CLAUDE.md` | Scope=all becomes a second filter path |
| "Building this in the browser exports the current page only, which is the bug we would be shipping instead of the feature." | ticket, Notes | Export silently drops all but 20 rows |
| "Money is integer minor units. Format at the edge... never store what a formatter returns." | `.claude/rules/money.md` | Cents drift; already satisfied, must stay so |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Dialog is not operable by keyboard/screen reader |

## Approach

Add a client dialog to the Export button on `/payments`. It offers a checkbox per column (last-four **unchecked** by default), a scope choice of current filter (default) or all payments with the row count shown for the selected scope, and a Download action that is disabled when no column is checked. Download navigates to `GET /api/payments/export` with the chosen `columns` and `scope` added to the existing filter params. The route stays server-side and keeps calling `filterPayments`/`sortPayments`: `scope=all` simply runs the builder with no filters rather than a new code path. The route validates `columns` against `EXPORT_COLUMNS` and `scope` against a two-value allowlist, rejects an empty column set with a 400, and computes the filename slug (`all`; the status when one is set; otherwise `filtered`). Row counts come from the server page, which already has the current-filter total and can get the all total from the same builder, so the dialog needs no separate fetch.

**Considered and rejected:** building the CSV in the browser from the table rows. It is simpler but exports only the current 20-row page, which is precisely the bug the ticket calls out. Also rejected: adding a new `Dialog` primitive and a Radix checkbox dependency. `Drawer.tsx` already wraps `@radix-ui/react-dialog` and gives us the accessible-name/focus/Escape behavior, and native labelled checkboxes styled with Tailwind avoid a new dependency.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/app/payments/export-dialog.tsx` | Add | Client dialog: column checkboxes, scope choice, row count, Download-disabled-when-empty, builds the export URL |
| `src/app/payments/page.tsx` | Change | Replace the plain Export `<a>` with the dialog trigger; pass columns, current query, current-filter total, and all-payments total |
| `src/lib/csv.ts` | Change | Add `parseColumns` (allowlist validation, order-preserving), a default column set with `last4` off, and a `slug` argument to `exportFilename` |
| `src/app/api/payments/export/route.ts` | Change | Validate `columns` and `scope`; run the builder with no filters when `scope=all`; 400 on empty columns; pass the slug to `exportFilename` |
| `src/lib/csv.test.ts` | Change | Extend with `parseColumns` validation and `exportFilename` slug cases; assert `last4` is off in the default set |

## Plan

Sequenced so each step ends somewhere verifiable.

1. **`csv.ts`: validation + filename** — add `parseColumns`, the last-four-off default set, and the `exportFilename(date, slug?)` argument. Done when: new unit tests pass and the existing `exportFilename` test is still green.
2. **`export/route.ts`: server enforcement** — parse and validate `columns` and `scope`, handle `scope=all` through the builder, 400 on empty, wire the slug. Done when: `curl` with a bad column drops it, `columns=` returns 400, and `scope=all` returns more rows than a filtered request.
3. **`export-dialog.tsx`: the dialog** — columns, scope, live row count, Download disabled when nothing is checked, URL built from current params. Done when: opening it on `/payments` shows the options and downloads a file matching the selection.
4. **`page.tsx`: wire it in** — swap the link for the trigger and pass the counts and query. Done when: the button opens the dialog and the counts match the table.
5. **Full check** — `npm test`, then `/ship-ready`. Done when: suite green and no rule flagged.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Open the dialog on `/payments`: last-four checkbox is unchecked; a `csv.test.ts` case asserts the default set excludes `last4` |
| Scope current-filter (default) or all; row count visible first | Dialog shows the count for the selected scope from the server-passed totals; toggling scope changes the number before download |
| Filename reflects scope and date | `exportFilename` unit tests: `all` slug, a status slug (`payments-disputed-2026-08-13.csv`), and `filtered`; downloaded file's name matches |
| Amounts in minor units, formatted once, currency in own column | Unchanged behavior in `csv.ts`; existing amount/currency tests stay green |
| Deselecting every column disables Download, no empty file | Dialog disables the button with zero columns; route returns 400 for `columns=`, proven by a request test |
| Columns validated server-side, not interpolated into SQL | `parseColumns` allowlist tests; there is no SQL, the store is in memory |
| Reuse the query builder; no browser-only export | Route still calls `filterPayments`/`sortPayments`; `scope=all` returns the full set, confirming it is not the current page |

## Risks

- **Row count staleness:** counts are computed at page render, so if a filter changes the page re-renders and the dialog re-mounts with fresh totals. Confirm the dialog reads props, holds no stale count in state.
- **Default column set for direct API hits:** the button always sends `columns`, so requiring it (400 when absent) is safe and also enforces the empty case. Watch for any other caller of the export route; there is none today.
- **`sortPayments` sorts amounts lexically** (`queries.ts:79-81`). Pre-existing and out of scope, but the export inherits the order; do not "fix" it here.

## Out of scope

- Persistence of export preferences (no store for it; NWP-203 owns persistence).
- New date-range filter UI. `parseFilters` supports `from`/`to`, but the filter bar does not expose them; leave that alone.
- Fixing the lexical amount sort noted above.

## Open questions

- Should `scope=all` still honor the current sort choice, or always default sort? Recommendation: honor the current `sort`/`direction` params so the file matches what ops last saw. Low risk either way.
