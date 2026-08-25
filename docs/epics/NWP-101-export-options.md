# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Claude Code
**Status:** draft

## Problem

Ops exports the payments table several times a day for merchant queries, month-end
reconciliation, and Finance requests. The export is fixed: every column, current filter
only. Card last-four ships in every file, so anything going to a merchant has to be
scrubbed by hand first — about 3–4 hours a month, and a near-miss last quarter where an
unedited file nearly reached the wrong merchant.

## Current state

- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?...">`, built from whatever's in the current `URLSearchParams` (`status`, `merchantId`, `search`, `page`). No dialog, no column choice, no scope choice.
- `src/app/api/payments/export/route.ts` — `GET` handler. Calls `parseFilters()`, then `filterPayments()` + `sortPayments()`, then `toCsv(rows)` with no column argument, so it always uses `EXPORT_COLUMNS`. Its own comment already flags this as NWP-101's job.
- `src/lib/csv.ts:13-24` — `EXPORT_COLUMNS` is the fixed, ordered tuple of all 10 columns, including `"last4"`. `toCsv(payments, columns = EXPORT_COLUMNS)` already accepts a `columns` argument and iterates it in order — the serializer is already column-order-aware, it's just never called with anything but the default.
- `src/lib/csv.ts:69-71` — `exportFilename(date)` returns `payments-<ISO date>.csv`. No scope segment.
- `src/data/queries.ts:18-36` — `parseFilters()` is the one allowlist boundary: status against `STATUSES`, `sort` against `"amount" | "createdAt"`, `direction` against `"asc" | "desc"`, `page` coerced and clamped. This is where new client input (columns, scope) has to be validated the same way — nothing from the client reaches the store or a filename unchecked.
- `src/data/queries.ts:87-99` — `paginate()` slices to `PAGE_SIZE` (20). The export route calls `filterPayments()` + `sortPayments()` directly and skips `paginate()`, so **the export is already all-matching-rows, not just the current page** — the ticket's "current filter only" scope already covers every row that matches the active filter, across all pages. What's missing for scope is the second option: ignore filters entirely and export every payment regardless of status/merchant/search.
- `src/lib/csv.test.ts` — existing tests pin cell escaping, the header-matches-`EXPORT_COLUMNS` contract, column subset + order (`toCsv([payment], ["id", "amount"])` already has a test), and the merchant-name fallback. These need to keep passing unchanged.
- No `Dialog` wrapper component exists in `src/components/` yet, but `@radix-ui/react-dialog` is already a dependency (used to build `Drawer.tsx`). `Drawer` is the closest existing pattern for a modal panel with header/body/footer.
- No checkbox component exists in `src/components/`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Validate on the server: anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store | `CLAUDE.md`, `.claude/rules/api-routes.md` | A crafted `columns` param could otherwise be reflected into a filename or an arbitrary CSV header |
| One query builder. Payment filtering goes through the one behind `GET /api/payments`. A second implementation is a defect | `CLAUDE.md` | Export and table drift out of sync on what counts as "current filter" |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md`, `.claude/rules/money.md` | A second formatter (or an early `.toFixed`) makes export and table disagree on amounts |
| Dialogs and forms must be operable: every input has a label, focus moves in and returns on close, Escape closes it | `.claude/rules/components.md` | Column checklist becomes unusable via keyboard/screen reader |
| Reuse what's in `src/components/` before hand-rolling a control | `.claude/rules/components.md` | A one-off checkbox/dialog implementation instead of the existing Radix-based patterns |

## Approach

Add an `ExportDialog` client component, opened from the existing Export button on
`/payments`, built on the same `@radix-ui/react-dialog` primitive `Drawer.tsx` already
wraps (a plain centered `Dialog`, not a slide-in drawer, since this is a form with a
count and a download action, not a detail panel). It lists the 10 `EXPORT_COLUMNS` as
checkboxes (`last4` unchecked by default), a scope radio (`Current filter` / `All
payments`, current filter default), and a live row count fetched from `GET
/api/payments` with `pageSize=1` (cheap, reuses `queryPayments()`'s `total`) so the
count reflects scope + filters without a second query implementation. Download is a
plain link to `GET /api/payments/export?...&columns=...&scope=...`, disabled when zero
columns are checked.

Server-side, extend `parseFilters` — or a sibling parser used only by the export route —
to read `columns` (comma-separated, filtered against `EXPORT_COLUMNS`, empty list is
valid and produces a header-only file) and `scope` (`"filtered" | "all"`, default
`"filtered"`). When `scope=all`, call `filterPayments({})` (no constraints) instead of
the parsed filters, still through the same function. Extend `exportFilename` to accept a
scope label — `all` or the active `status` filter when one is set (e.g.
`payments-disputed-2026-08-13.csv`), `payments-<date>.csv` otherwise, matching the
ticket's example.

**Considered and rejected:** building the CSV client-side from the rows already on the
page. Rejected because the table is paginated at 20 rows and the ticket calls this out
explicitly as "the bug we would be shipping instead of the feature" — the server route
already exports all matching rows for the current filter, and client-side assembly would
regress that to one page.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/components/Dialog.tsx` | Add | Wraps `@radix-ui/react-dialog`, mirroring the `Drawer.tsx` pattern (Root/Trigger/Content/Header/Title/Body/Footer) but centered, not slide-in |
| `src/components/Checkbox.tsx` | Add | No existing checkbox primitive; needed for the column list |
| `src/app/payments/export-dialog.tsx` | Add | Client component: column checkboxes, scope radio, live count, Download link, disabled-when-empty state |
| `src/app/payments/page.tsx` | Change | Swap the plain `<a>` Export button for `<ExportDialog>`, passing the current filter query string |
| `src/data/queries.ts` | Change | Add `EXPORT_SCOPES` allowlist and extend/adapt `parseFilters` (or a new `parseExportFilters`) for `scope`; expose a way to get an unfiltered count for the "all payments" row count |
| `src/lib/csv.ts` | Change | Add a `parseColumns(raw: string \| null): ExportColumn[]` allowlist helper; extend `exportFilename(date, scope?)` to embed the scope segment |
| `src/app/api/payments/export/route.ts` | Change | Read `columns` + `scope` from the query string via the new parsers, branch `filterPayments(scope === "all" ? {} : filters)`, pass columns to `toCsv`, pass scope to `exportFilename` |
| `src/lib/csv.test.ts` | Change | Extend with cases for `parseColumns` and the scope-aware filename (see Verification) |

## Plan

1. **`parseColumns` in `csv.ts`** — allowlist against `EXPORT_COLUMNS`, dedupes, preserves requested order, empty/all-invalid input returns `[]`. Done when: unit tests for it pass.
2. **`exportFilename` scope support** — add an optional second argument, default behavior unchanged (existing test keeps passing). Done when: existing `exportFilename` test still passes and a new scoped case passes.
3. **Route handler** — parse `columns` and `scope`, validate `scope` against `["filtered", "all"]`, branch the `filterPayments` call, wire columns/scope into `toCsv`/`exportFilename`. Done when: `curl` against `/api/payments/export?scope=all` and `?columns=id,amount` return the expected header rows.
4. **`Dialog.tsx` and `Checkbox.tsx`** — new primitives following the existing component conventions (Tailwind only, `focusRing` from `lib/utils`, forwardRef). Done when: they render and are keyboard-operable in isolation.
5. **`ExportDialog`** — column checkboxes (last4 default off), scope radio, count fetched from `/api/payments?...&pageSize=1`, Download href built from selections, disabled when zero columns selected. Done when: opening it on `/payments`, toggling columns/scope updates the visible count and the Download link's query string.
6. **Wire into `page.tsx`** — replace the existing anchor with `<ExportDialog>`. Done when: clicking Export opens the dialog instead of downloading immediately.
7. **Tests** — extend `src/lib/csv.test.ts` per Verification below. Done when: `npm test` passes.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Manual: open dialog on `/payments`, confirm `last4` checkbox starts unchecked; `csv.test.ts` case for `parseColumns` |
| Scope: current filter (default) or all payments, row count visible before download | Manual: toggle scope, watch the count update; confirms `filterPayments({})` path is exercised for "all" |
| Filename reflects scope and date | `csv.test.ts` cases: `exportFilename(date)` unscoped, `exportFilename(date, "disputed")`, `exportFilename(date, "all")` |
| Amounts stay minor units internally, formatted once, currency its own column | Unchanged — `toCsv`'s existing `cell()` already does this; no new formatting path introduced |
| Deselecting every column disables Download | Manual: uncheck all boxes, confirm Download is disabled, not an empty-file download |
| Unit test covers the column serializer | `csv.test.ts`: subset + reordered columns (existing), plus new `parseColumns` cases: valid subset, unknown column name dropped, empty input |

## Risks

- `Dialog.tsx` and `Checkbox.tsx` are new shared primitives — worth a quick check that nothing else in `src/components/` already half-covers this (confirmed during research: nothing does).
- The live row count needs a request that doesn't itself go through `paginate()`'s 20-row slice; using `pageSize=1` on the existing endpoint keeps it to one query-builder call rather than adding a second "count" endpoint.

## Out of scope

- Persisting a chosen column set between sessions.
- Any format other than CSV.
- Cards/virtual card columns — NWP-201 hasn't shipped cards yet.

## Open questions

- None blocking. If `scope=all` combined with a `status` filter should still label the file by status (ticket's own example) even though "all payments" ignores filters for content, the filename plan above follows the filter, not the scope, for the label when a status is set — matches the ticket's literal example (`payments-disputed-...csv` implies a status filter drove the name, not "all").
