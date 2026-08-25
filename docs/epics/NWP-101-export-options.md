# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** sxchen210@gmail.com
**Status:** draft

## Problem

Ops exports the payments table several times a day for merchant queries, reconciliation, and Finance. The export is fixed — every column, current filter only. Card last-four is in every file, so anything sent to a merchant needs manual cleanup (3–4 hours/month). Last quarter an unedited file nearly went to the wrong merchant.

## Current state

- **Export button** — `src/app/payments/page.tsx:68-77`. An `<a>` tag that links directly to `/api/payments/export?{current filters}`. No dialog, no options. Click = immediate download.
- **Export route handler** — `src/app/api/payments/export/route.ts`. Calls `parseFilters()` → `filterPayments()` → `sortPayments()` → `toCsv(rows)` → returns a CSV `Response`. All 10 columns, always.
- **Query builder** — `src/data/queries.ts`. `parseFilters()` validates client params against allowlists. `filterPayments()` handles status, merchantId, search, date range. `sortPayments()` sorts by createdAt or amount. `paginate()` is separate — the export route skips it and gets all matching rows.
- **CSV serializer** — `src/lib/csv.ts`. `toCsv()` already accepts an optional `columns` parameter (defaults to all 10). `EXPORT_COLUMNS` is the allowlist. `exportFilename()` generates `payments-YYYY-MM-DD.csv` with no scope info.
- **CSV tests** — `src/lib/csv.test.ts`. Cover escaping, column subsetting, merchant resolution, empty rows. The test for column subsetting (`toCsv([payment], ["id", "amount"])`) already proves `toCsv` works with a subset.
- **Filter bar** — `src/app/payments/filter-bar.tsx`. Client component with status, merchant, and search filters. Current filter state lives in URL search params.
- **Money formatting** — `src/lib/money.ts`. `formatMoney()` converts minor units to display. The CSV serializer already calls this — amounts are formatted on the way out, not stored as strings.
- **UI components** — `src/components/Drawer.tsx` (Radix Dialog-based), `Button.tsx`, `Input.tsx`, `Select.tsx` are all available. No standalone Dialog component; Drawer is the closest.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units | `CLAUDE.md`, `money.md` | Amounts drift; CSV would show raw cents |
| Validate everything from the client | `CLAUDE.md`, `api-routes.md` | Column name injection into the CSV or query |
| One query builder | `CLAUDE.md` | Two filter paths that disagree on scope |
| Format at the edge | `money.md`, `components.md` | Double-formatting or raw integers in the file |
| Column names from client → validate server-side | Ticket notes | Arbitrary strings reach the serializer |

## Approach

Add a Drawer dialog that opens when the user clicks Export. The dialog shows checkboxes for each column (last4 unchecked by default), a radio or toggle for scope (current filter vs. all payments), and the matching row count. On submit, the dialog builds a URL with `columns` and `scope` query params and navigates to the export route. The route handler validates column names against `EXPORT_COLUMNS`, decides whether to apply filters or skip them based on scope, and passes the validated column list to `toCsv()`. `exportFilename()` gets an optional scope label so the filename reflects what's in the file.

**Considered and rejected:** Building the export client-side by fetching all pages and assembling the CSV in the browser. Rejected because the payments table is paginated, so you'd either need to fetch every page (slow, fragile) or build a separate "fetch all" endpoint anyway. The server already has the full dataset — keep the export there.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/app/payments/page.tsx` | Change | Replace the direct `<a>` export link with a Drawer trigger |
| `src/app/payments/export-dialog.tsx` | Add | Client component: column checkboxes, scope toggle, row count, download link |
| `src/app/api/payments/export/route.ts` | Change | Read and validate `columns` and `scope` params; pass columns to `toCsv()`; scope=all skips filters |
| `src/lib/csv.ts` | Change | Update `exportFilename()` to accept an optional scope/status label |
| `src/lib/csv.test.ts` | Change | Add tests for `exportFilename()` with scope labels |

## Plan

1. **Update `exportFilename()`** — accept an optional `label` param so it can produce `payments-disputed-2026-08-13.csv`. Add tests in `csv.test.ts`. Done when: `npm test` passes with the new cases.

2. **Update the export route handler** — read `columns` param (comma-separated), validate each against `EXPORT_COLUMNS`, reject any unknown names with 400. Read `scope` param (`filter` or `all`); when `all`, skip `filterPayments()`. Pass validated columns to `toCsv()`. Pass scope label to `exportFilename()`. Done when: hitting `/api/payments/export?columns=id,amount&scope=all` returns a two-column CSV of all payments.

3. **Build the export dialog** — a `"use client"` component using Drawer. Checkboxes for each column (last4 unchecked by default). Scope selector: "Current filter" (default) vs. "All payments". Show the matching row count (passed as a prop from the server page). Disable Download when no columns are selected. Done when: the dialog opens, toggles work, and the download link builds the correct URL.

4. **Wire into the payments page** — replace the `<a>` export link with a Drawer trigger. Pass the current `total` count and filter state to the dialog. Done when: clicking Export opens the dialog, and downloading produces the correct CSV.

5. **Test end to end** — verify: column subset works, last4 is excluded by default, scope=all ignores filters, filename reflects scope, empty column selection disables download, invalid column names return 400. Done when: all acceptance criteria confirmed.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose which columns; last4 off by default | Open dialog → last4 is unchecked → download → CSV has no last4 column |
| Ops can choose scope: current filter or all | Set a status filter → export with "All payments" → CSV has rows from every status |
| Row count visible before download | Dialog shows count that matches the page's "N payments" label |
| Filename reflects scope and date | Download with status=disputed → file is `payments-disputed-2026-08-25.csv` |
| Amounts in minor units internally, formatted on export, currency in own column | Check CSV: amount column shows `$250.00`, currency column shows `USD` |
| Deselecting every column disables Download | Uncheck all → Download button is disabled/grayed out |
| `npm test` passes | Run `npm test` — existing tests still pass, new filename tests pass |

## Risks

- **Row count for "all payments" scope** — the page only knows the filtered count. For the "all" scope count, either pass the total store size as a prop or accept that the count updates only after selecting scope (simpler: always show both counts).
- **Large exports** — the in-memory store is small (generated data), so streaming is not needed. If the dataset grew, this would need a streaming response. Out of scope for the in-memory store.

## Out of scope

- Persistence (NWP-203)
- Date-range scoping beyond what the existing filters provide
- Async/background export for large datasets
- Column reordering or custom column names

## Open questions

- Should the "all payments" row count be fetched client-side or passed from the server? Recommendation: pass `store.payments.length` from the server page as a prop — it's cheap and avoids an extra fetch.
