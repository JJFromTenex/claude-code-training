# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Jon High
**Status:** building

## Problem

Ops exports the payments table several times a day, but every export ships every column, including
the card last four, for the current filter only. Dana's team spends 3-4 hours a month cleaning up
files by hand before they can go to a merchant, and there was a near-miss last quarter where an
unedited file nearly reached the wrong merchant. Ops needs to choose which columns go out and
whether the export covers the current filter or the whole table.

## Current state

- `src/app/api/payments/export/route.ts` — reads filters with `parseFilters`, runs
  `filterPayments` + `sortPayments` (no pagination), and returns `toCsv(rows)` with the fixed
  full column set. Filename came from `exportFilename()` -> `payments-YYYY-MM-DD.csv`.
- `src/lib/csv.ts` — already had `toCsv(payments, columns)`, taking an ordered subset of
  `EXPORT_COLUMNS`. `amount` is formatted once via `formatMoney`; `currency` is its own column.
  Cell-writing logic (escaping, formatting) was untouched by this ticket.
- `src/app/payments/page.tsx` — rendered Export as a plain `<a href="/api/payments/export?<query>">`
  inside `Button variant="secondary" asChild`. Server component, already has `total` and `query`
  (`URLSearchParams`).
- `src/data/queries.ts` — exports `parseFilters`, `filterPayments`, `sortPayments`,
  `queryPayments`. This is the one query builder; the export route and the new "all payments"
  scope both go through it.
- `src/components/` had no `Dialog.tsx` before this ticket. `Drawer.tsx` wraps
  `@radix-ui/react-dialog` (already a dependency) and was the pattern to follow.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Validate everything from the client against an allowlist | `.claude/rules/api-routes.md` | An unvalidated `columns` param could reference columns that don't exist or leak internals |
| Reuse the one query builder; a second filter path is a defect | `.claude/rules/api-routes.md`, ticket notes | "All payments" scope could drift from the filtered list's semantics |
| Bucket and compare in UTC | `.claude/rules/api-routes.md` | Filenames or date filters would shift with server timezone |
| Amounts are integer minor units, formatted once at the edge | `.claude/rules/money.md` | Cents drift or the amount column disagrees with the on-screen table |
| Dialogs and forms must be operable: labelled inputs, accessible name, focus management | `.claude/rules/components.md` | Ops using the keyboard or a screen reader can't complete an export |
| Tailwind only, no inline `style` (except the Radix animation pattern already in `Drawer.tsx`) | `.claude/rules/components.md`, build instructions | Style drifts from the rest of the design system |

## Approach

Add a `Dialog` component (Tremor-style, mirroring `Drawer.tsx`) and an `ExportDialog` client
component that replaces the plain Export link. The dialog lets ops pick columns (checkboxes,
`last4` unchecked by default) and scope (radio: current filter vs. all payments, current filter
default), shows the row count for the selected scope, and builds a `Download CSV` link pointing at
the export route with `scope` and `columns` query params. The route validates `columns` against
`EXPORT_COLUMNS` and rejects an empty selection with a 400. "All payments" calls
`filterPayments({})` — the same query builder, called with no filters — rather than a second
implementation.

**Considered and rejected:** building the export client-side from the payments already rendered on
`/payments`. Rejected because the table is paginated — a browser-side export would only cover the
current page, which is the exact bug the ticket exists to prevent, not the feature.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Add `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, and give `exportFilename` a `scope` argument |
| `src/app/api/payments/export/route.ts` | Change | Read `scope` and `columns` from the query string, validate, and reject an empty column selection |
| `src/components/Dialog.tsx` | Add | Reusable Radix-backed dialog, styled like `Drawer.tsx`, centered rather than a side panel |
| `src/app/payments/export-dialog.tsx` | Add | Client component holding column/scope state and the export link |
| `src/app/payments/page.tsx` | Change | Swap the plain Export link for `<ExportDialog>`, pass `total`, all-payments count, and a status label |
| `src/lib/csv.test.ts` | Change | Extend with `parseExportColumns` tests and an updated `exportFilename` test |

## Plan

1. **Extend `csv.ts`** — done when `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, and the new
   `exportFilename(scope, date)` signature exist and existing `toCsv` tests still pass.
2. **Update the export route** — done when `GET` validates `columns`, honors `scope`, and returns
   400 with a message when no valid column is selected.
3. **Build `Dialog.tsx`** — done when it exports `Dialog`, `DialogTrigger`, `DialogClose`,
   `DialogContent`, `DialogTitle`, `DialogDescription`, `DialogFooter`, styled per
   `.claude/rules/components.md`.
4. **Build `ExportDialog`** — done when it renders the column checklist, scope radios, a live row
   count, and disables Download when zero columns are selected.
5. **Wire it into `/payments`** — done when the Export button opens the dialog and the page still
   compiles with `total` and `filterPayments({}).length` passed through.
6. **Tests** — done when `npm test` passes with the extended `csv.test.ts`.
7. **Type and lint check** — done when `npx tsc --noEmit` and `npm run lint` are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; `last4` off by default | `parseExportColumns(null)` test asserts `DEFAULT_EXPORT_COLUMNS` excludes `last4`; dialog initializes `columns` state from the same constant |
| Ops can choose scope; current filter is default and row count is visible | `ExportDialog` state defaults to `scope: "filtered"`; row count text renders from `filteredCount`/`allCount` before download |
| Filename reflects scope and date, e.g. `payments-disputed-2026-08-13.csv` | `exportFilename` tests for `"all"` and `"disputed"` scopes; route derives the scope label from `filters.status` or `"all"`/`"filtered"` |
| Amounts stay in minor units internally, formatted once, currency in its own column | Unchanged `toCsv`/`cell` logic, still covered by the pre-existing `toCsv` tests |
| Deselecting every column disables Download instead of an empty file | `ExportDialog` renders a disabled `Button` plus a "Select at least one column." hint when `columns.length === 0`; route independently returns 400 for an empty/invalid `columns` param |

## Risks

- The dialog's checkbox/radio markup is hand-rolled (no `Checkbox` component exists yet in
  `src/components/`). Mitigated by using native, correctly labelled inputs per the components rule.
- `columns` and `scope` are read from a client-controlled query string on the download link, not a
  form POST — validated identically to any other client input on the server side.

## Out of scope

- `sortPayments` in `src/data/queries.ts` compares amounts as strings (`String(a.amount)`), not
  numerically. That's a pre-existing sort-order bug, not part of NWP-101.
- Persisting a user's preferred column set between sessions.
- Async/streaming export for very large "all payments" scopes; the dataset here is small enough
  for a synchronous response.

## Open questions

- None outstanding — the ticket's acceptance criteria and notes fully scope the change.
