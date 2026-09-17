# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Dana Whitfield (reporter) / engineer via `/spec`
**Status:** draft

## Problem

Ops exports the payments table several times a day and every export is identical: every column, current filter only, no choice. Card last-four ships in every file, so anything headed to a merchant needs manual cleanup first — Dana's team spends 3-4 hours a month on this, and a near-miss last quarter nearly sent an unedited file to the wrong merchant. Ops needs to pick which columns go out and whether the file covers the current filter or the whole table, before the download starts.

## Current state

- `src/app/api/payments/export/route.ts` — `GET` handler. Parses filters with `parseFilters`, reuses `filterPayments`/`sortPayments`, calls `toCsv(rows)` with no column argument (so `EXPORT_COLUMNS` is used) and `exportFilename()` with no args. Column set and scope are both hardcoded today, as the file's own comment says.
- `src/lib/csv.ts` — `toCsv(payments, columns = EXPORT_COLUMNS)` already accepts an explicit column list and preserves order; nothing here needs to change. `EXPORT_COLUMNS` includes `last4` and is the default when no columns are passed. `exportFilename(date)` takes an optional date but has no scope or filter-label parameter.
- `src/data/queries.ts` — `parseFilters` is the one allowlist-checked filter parser; `filterPayments`/`sortPayments`/`queryPayments` are the one query builder. `filterPayments({})` (or a filters object with `status: "all"` and nothing else set) returns every payment — this is how "all payments" scope is expressed without a second code path.
- `src/app/payments/page.tsx` — renders the current Export `<a href="/api/payments/export?...">` button (lines 68-76), passing through the current query string untouched. `queryPayments(filters)` already returns `total` for the current filter's row count.
- No column-picker or scope dialog exists. `src/components/Drawer.tsx` wraps `@radix-ui/react-dialog` and is the dialog primitive already in the codebase (Radix `Root`/`Trigger`/`Content`/`Close`, all built out) — reuse it rather than adding a new Dialog component or dependency, per `.claude/rules/components.md` ("Use what is here").
- No checkbox/radio primitive exists in `src/components/`. One needs to be added or the dialog needs to use plain labelled `<input type="checkbox">`/`<input type="radio">` styled with Tailwind, consistent with "Tailwind only, no inline style" in `components.md`.
- `src/lib/csv.test.ts` already pins `toCsv`'s column-subset and header behavior — the column serializer this ticket's required unit test extends already exists and already passes with arbitrary column subsets; the gap is exercising the new default (last4 off) and the "no columns selected" case at the API layer.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Column names from the client must be validated server-side against an allowlist, never interpolated into a query | `docs/tickets/NWP-101.md`, `.claude/rules/api-routes.md` | Arbitrary column injection into the CSV or store |
| Reuse the one query builder behind `GET /api/payments` | `.claude/rules/api-routes.md`, ticket notes | A second, drifting filter implementation |
| Never return a full card number from a list route | `.claude/rules/api-routes.md` | last4-only is already respected by `EXPORT_COLUMNS`; do not add a full-PAN column |
| Amounts are integer minor units; format once, at the edge, with currency in its own column | `merchant-console/CLAUDE.md`, `.claude/rules/money.md` | `toCsv`'s `amount` cell already calls `formatMoney` and `currency` is already its own column — preserve this, don't reformat elsewhere |
| Storage and bucketing are UTC | `merchant-console/CLAUDE.md` | Scope/date-range filtering must keep using `filterPayments`, which compares `createdAt` (UTC) directly |
| Use existing components before adding a dependency | `.claude/rules/components.md` | A second dialog/checkbox implementation when `Drawer` and Tailwind already cover it |

## Approach

Add a client-side `ExportDialog` (built on `Drawer`) that replaces the plain Export link on `/payments`. It lists `EXPORT_COLUMNS` as checkboxes (all checked except `last4`, which defaults off), a scope radio (`current filter` / `all payments`, current filter default), and a row count that updates with scope — computed from `total` (current filter, already available on `page.tsx` from `queryPayments`) and a second `allTotal` computed the same way with an empty filter set, both passed into the dialog as props from the server component. Download is disabled when zero columns are checked. Confirming builds a query string (existing filter params + `columns=` + `scope=`) and navigates to the export route, which now validates `columns` against `EXPORT_COLUMNS` and, when `scope=all`, calls `filterPayments({})` instead of the parsed filters. `exportFilename` gains an optional scope label so filenames read `payments-<scope>-<date>.csv`.

**Considered and rejected:** fetching the "all payments" row count from the client via a call to `GET /api/payments` when the dialog opens. Rejected because the store is in-memory and cheap to query, `page.tsx` is already a server component computing `total` once per render, and adding a client fetch would mean a second place row counts are derived — the existing query builder gives us both numbers for free at render time with no new endpoint.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/app/payments/page.tsx` | Change | Compute `allTotal` via `filterPayments({})`, replace the `<a>` Export button with `<ExportDialog>`, pass current query params, `total`, `allTotal` |
| `src/app/payments/export-dialog.tsx` | Add | Client component: column checkboxes, scope radio, live row count, Download disabled when no columns selected, builds the export URL |
| `src/app/api/payments/export/route.ts` | Change | Read and validate `columns` (allowlist against `EXPORT_COLUMNS`) and `scope` (`current`\|`all`) from the query string; when `scope=all`, bypass `parseFilters` result for the row source via `filterPayments({})`; pass validated columns to `toCsv` and scope to `exportFilename` |
| `src/lib/csv.ts` | Change | `exportFilename(date, scope?)` — add optional scope segment to the filename; no change to `toCsv` or `EXPORT_COLUMNS` |
| `src/lib/csv.test.ts` | Change | Extend: default-columns-minus-last4 case is already implicit via explicit column lists, add a case for `exportFilename` with a scope label |
| `src/app/api/payments/export/route.test.ts` | Add | New: invalid/unknown column names are rejected, not interpolated; zero valid columns; `scope=all` ignores active filters and returns the full table |

## Plan

1. **Extend `exportFilename`** to accept an optional scope label, defaulting to today's unlabeled behavior — done when: `npm test` passes with a new test asserting `payments-disputed-2026-08-13.csv`-shaped output.
2. **Validate `columns` and `scope` in the export route** against the `EXPORT_COLUMNS` allowlist and a fixed `current`/`all` set, defaulting to today's behavior when absent — done when: a manual `curl` with a bogus column name returns the file with that column silently dropped, not injected.
3. **Wire `scope=all`** to call `filterPayments({})` (still through the shared query builder) instead of the parsed filters, and confirm `total` differs from `allTotal` in a filtered scenario — done when: exporting with `status=disputed&scope=all` returns every payment, not just disputed ones.
4. **Build `ExportDialog`** on `Drawer` with column checkboxes (last4 off by default) and scope radio, disabling Download at zero columns — done when: the dialog opens from `/payments`, keyboard-only use (Tab, Space, Escape) reaches and toggles every control, and Download is visibly disabled with none checked.
5. **Wire the row count** to switch between `total` and `allTotal` as the scope radio changes, no network call — done when: toggling scope updates the visible count synchronously.
6. **Swap the Export button** on `page.tsx` for `ExportDialog`, passing through current filters as the download's base query string — done when: confirming the dialog with defaults downloads the same file shape as today, minus `last4`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last4 off by default | `export-dialog` renders all `EXPORT_COLUMNS` as checkboxes, `last4` unchecked on open — manual check in browser |
| Ops can choose scope; current filter default; row count visible before download | Manual check: open dialog on a filtered `/payments` view, confirm count matches the filtered total, toggle to "all" and confirm it changes |
| Filename reflects scope and date | New test in `src/lib/csv.test.ts` for `exportFilename(date, scope)` |
| Amounts stay minor units internally, formatted once at the edge, currency in its own column | Already true in `toCsv`/`formatMoney`; no regression — existing `src/lib/csv.test.ts` cases still pass |
| Deselecting every column disables Download | `export-dialog` unit/manual check: uncheck all, confirm Download `disabled` |
| Column names validated server-side, never interpolated | New `route.test.ts` case: unknown/malformed column name in query string does not appear in output and does not error the store |
| `npm test` passes | Run `npm test` before opening the PR |

## Risks

- `filterPayments({})` must genuinely mean "no filters" (status `"all"`, nothing else set) — confirm against `parseFilters`'s defaults rather than constructing that object by hand in two places; prefer building it from `parseFilters(new URLSearchParams())` if that reads cleaner than a literal.
- Radix `Dialog` (via `Drawer`) already handles focus trapping and Escape; the risk is the checkbox/radio markup, not the dialog shell. Verify labels are programmatically associated (`htmlFor`/`id`), not just visually adjacent.

## Out of scope

- Changing what happens for zero-row exports (the empty-file behavior of `toCsv([], columns)` is unchanged and already tested).
- Persisting the ops user's last-used column selection between sessions — not asked for in the ticket.
- NWP-102 (linked but separate ticket) — not read as part of this spec.

## Open questions

- None blocking. If Dana's team wants column selections remembered per-user, that's a follow-up ticket, not part of this one.
