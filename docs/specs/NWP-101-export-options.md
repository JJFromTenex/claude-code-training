# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** qishenxu
**Status:** done

## Problem

Ops exports the payments table several times a day, and every file carries every column, including the card last four. Anything going to a merchant is cleaned by hand first: 3–4 hours a month, plus a near-miss where an unedited file nearly went to the wrong merchant. Dana's team wants to pick the columns and the scope before downloading.

## Current state

All paths are under `build-battle/merchant-console/`.

- `src/app/payments/page.tsx:68-76` — Export is a plain `<a href="/api/payments/export?{query}">`. It forwards the current URL query, including `page`.
- `src/app/api/payments/export/route.ts:11-25` — calls `parseFilters`, then `filterPayments` and `sortPayments`. It never paginates, so the file already holds every matching row. It always calls `toCsv(rows)` with the default columns and `exportFilename()` with no scope.
- `src/data/queries.ts:18-36` — `parseFilters` allowlists status, sort and direction. This is the one query builder (`queries.ts:38-41`).
- `src/app/api/payments/route.ts` — `GET /api/payments` returns `{ rows, total, page, pageCount }` through the same builder. `total` is the row count the dialog needs.
- `src/lib/csv.ts:13-24` — `EXPORT_COLUMNS` (10 columns, `last4` included). `toCsv(payments, columns)` already accepts a column list (`csv.ts:58-67`), but nothing passes one. `exportFilename(date)` returns `payments-YYYY-MM-DD.csv` in UTC (`csv.ts:69-71`).
- `src/lib/csv.test.ts` — 9 tests pin escaping, column order and the UTC filename. Its header comment says they must still pass after NWP-101.
- `src/lib/money.ts:15` — `formatMoney` is the only formatter. `csv.ts:52` calls it once per amount cell, and `currency` is already its own column.
- **Where the ticket doesn't match the code:**
  - There is no Dialog component, although `.claude/rules/components.md` used to list one. `src/components/Drawer.tsx` shows the pattern on `@radix-ui/react-dialog`, which is installed.
  - There is no Checkbox component.
  - No route returns errors yet, so there is no existing error shape to match.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Column names arrive from the client, so **validate them server-side**." | ticket, notes | Arbitrary input reaches `cell()` and the response |
| "Anything from the client … is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md`, rule 4 | Scope text injected into `content-disposition` |
| "There is already a query builder behind `GET /api/payments`. Reuse it." | ticket, notes | Export and row count disagree |
| "Building this in the browser exports the current page only." | ticket, notes | Ships 20 rows instead of all of them |
| "Money is integer minor units … Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md`, rule 1 | Floats in the file, double formatting |
| "Return the same error shape everywhere" | `.claude/rules/api-routes.md` | Dialog can't show a server rejection |

## Approach

The export stays a server-side download through the existing route. The route gains two allowlisted query parameters:

- `columns`: a comma-separated list, kept in the order given.
- `scope`: `filtered` or `all`.

Column parsing lives in `src/lib/csv.ts`, beside `EXPORT_COLUMNS`, as a pure function the tests can call. It handles three cases:

- Parameter missing: return the default columns, which are every column except `last4`.
- Any unknown or empty entry: reject.
- Duplicates: drop them.

The route returns `400 { error }` for a bad column or scope list. For `scope=all` it ignores the filters but keeps sort. `exportFilename` gains an optional scope label: `all`, the status when filtering by status, otherwise `filtered`. Every value it can produce comes from an allowlist.

A new Dialog primitive is added, plus a client `ExportDialog` on `/payments`. The dialog has:

- A checkbox for each column, with `last4` unchecked by default.
- A scope choice, with "current filter" as the default.
- A row count, fetched from `GET /api/payments` with the same query.
- A Download link, disabled when no column is selected.

**Considered and rejected:** building the CSV in the browser from the rows already on screen. It exports one 20-row page, duplicates the query builder, and is the bug the ticket warns against. Also rejected: a new count endpoint. `GET /api/payments` already returns `total` from the same builder.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Default columns without `last4`, column parser, scope-aware `exportFilename` |
| `src/app/api/payments/export/route.ts` | change | Validate `columns` and `scope`, return 400 with `{ error }`, pass both through |
| `src/lib/csv.test.ts` | change | Tests for column selection, default exclusion, empty selection, filename scope |
| `src/components/Dialog.tsx` | add | Radix dialog primitive in the Tremor style, modelled on `Drawer.tsx` |
| `src/app/payments/export-dialog.tsx` | add | Client dialog: columns, scope, row count, Download |
| `src/app/payments/page.tsx` | change | Swap the bare Export link for `ExportDialog`, passing the current query |

## Plan

1. **Column parser and defaults in `csv.ts`.** Done when it type-checks and the existing 9 tests still pass.
2. **Route validation.** Done when, against the dev server:
   - The bare export has no `last4`.
   - `columns=last4,id` returns exactly those two, in that order.
   - `columns=` and `columns=nope` each return 400 with `{ error }`.
   - `scope=all` returns 1,658 rows.
   - The filename reads `payments-disputed-<date>.csv` for a disputed export.
3. **`npm test`**, then add the column tests to `csv.test.ts` and run it again. Done when the suite is green with the new cases.
4. **Dialog primitive and `ExportDialog`.** Done when the dialog opens from Export with `last4` unchecked, the count changes with scope, and unticking every box disables Download.
5. **Page wiring and browser check.** Done when a download from the dialog matches the chosen columns, scope and filename.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns, last four off by default | Test: the defaults exclude `last4`. Curl: the bare export has no `last4`. Browser: the box is unchecked on open |
| Scope: current filter (default) or all, count visible first | Browser: the count shows 33 for disputed and 1,658 for all. Curl: `scope=all` row count |
| Filename reflects scope and date | Tests for `exportFilename` with each label. Curl: the `content-disposition` header |
| Amounts stay in minor units, formatted once, currency in its own column | Unchanged `cell()` path. The existing `"$1,234,567.89"` and currency-column tests still pass |
| No columns disables Download | Browser: the button is disabled. Test: the parser rejects an empty list. Curl: `columns=` returns 400 |

## Risks

- **Mismatched counts:** the count and the file could disagree if they parse filters differently. Both go through `parseFilters`, so they match. `page.tsx` builds its own filters for the table, which is noted below and left alone.
- **Native controls:** the checkboxes and radios are styled native inputs, because no Checkbox exists and the rules say not to add a dependency for one.

## Out of scope

- **Amount sorting:** `sortPayments` sorts amounts as strings (`queries.ts:79-82`). It's a real bug, but not this ticket. Report it under "Bugs fixed along the way" only if it gets fixed.
- **Table filter parsing:** moving `page.tsx` onto `parseFilters` for the table itself.
- **Saved column presets,** and per-merchant filenames.

## Open questions

- **Filename when filtering by merchant or search only:** this spec uses `payments-filtered-<date>.csv`. Should it name the merchant instead?
