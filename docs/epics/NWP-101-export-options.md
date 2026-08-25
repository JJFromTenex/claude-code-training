# EPIC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Tiago
**Status:** draft

## Problem

Ops exports the payments table several times a day and always gets every column at the current filter's full result set, no say in either. The card last-four is in every file, so anything headed to a merchant needs manual cleanup first — Dana's team estimates 3-4 hours a month of it, and there was a near-miss last quarter where an unedited file almost went to the wrong merchant. They need to choose which columns ship (last-four off by default) and whether the export covers the current filter or every payment, with the row count visible before they commit to a download.

## Current state

- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?<current filter query string>">`. No dialog, no options.
- `src/app/api/payments/export/route.ts` — `GET` parses the current filters with `parseFilters()`, runs them through `filterPayments()` + `sortPayments()` (the same builder the table uses, just without pagination — so it already exports every matching row, not the current page), and pipes the result through `toCsv()`. Column set and scope are both hardcoded.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` (all 10 columns, `last4` included) is the only column set. `toCsv(payments, columns = EXPORT_COLUMNS)` already accepts an arbitrary column subset **in the order given** — this half of the feature just needs a caller. `exportFilename(date)` produces `payments-<date>.csv` with no scope in it. `formatMoney()` is already the only place a decimal point appears, and `amount`/`currency` are already separate columns — AC4 is satisfied today and just needs to survive the change untouched.
- `src/data/queries.ts` — `filterPayments(filters)` is the one query builder. Calling it with `{}` (no filters) returns every payment, so "all payments" scope is `filterPayments({})`, not a second code path.
- `src/lib/csv.test.ts` — tests pin cell escaping and the "arbitrary column subset, in order" contract. These should not need to change. `exportFilename`'s one test will need to change, since its output format is changing.
- No Dialog primitive exists, but `src/components/Drawer.tsx` wraps `@radix-ui/react-dialog` with accessible title/description/focus-trap/close already wired up — this is the dialog.
- No checkbox component exists as a standalone primitive (`DropdownMenuCheckboxItem` is menu-specific). Plain labeled `<input type="checkbox">` is the right tool here, not a new component.
- No component-testing harness exists — `vitest.config.ts` runs `environment: "node"`, no jsdom, no `@testing-library/react`. UI behavior (default unchecked state, disabled Download) is verified manually in the browser, not by a unit test.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md`, `.claude/rules/money.md` | Already correct in `toCsv`'s `amount` cell via `formatMoney()` — must stay that way, not get re-derived in the dialog |
| Validate anything from the client against an allowlist before it reaches a query, filename, or store | `.claude/rules/api-routes.md` | `columns` and `scope` arrive as query params; an unvalidated column name is exactly the SQL-interpolation risk the ticket calls out by name |
| One query builder — a second filter/sort implementation is a defect | `CLAUDE.md`, `.claude/rules/api-routes.md` | "All payments" scope must be `filterPayments({})`, not `store.payments` read directly |
| Bucket and compare in UTC | `.claude/rules/api-routes.md` | `exportFilename`'s date stamp already uses `date.toISOString()`; the new scope label must not introduce local-time formatting |
| Dialogs must be operable: accessible name, labeled inputs, focus in/out, Escape closes | `.claude/rules/components.md` | Reuse `Drawer`'s existing `DrawerTitle`/`DrawerDescription`/focus trap rather than a hand-rolled `<div>` overlay |
| Card last-four is sensitive by default | ticket description (the near-miss) | Both the dialog's default checkbox state *and* the server's default (when `columns` is omitted from the URL) must exclude `last4` — a bookmarked or hand-typed export URL is a real path here, not just the dialog |

## Approach

Add a client-side `ExportDialog` (built on `Drawer`) that replaces the bare Export `<a>`, offering a checkbox per `EXPORT_COLUMNS` entry (`last4` unchecked by default) and a scope choice (current filter / all payments, current filter default) with the matching row count shown next to each option — both counts are computed server-side in `page.tsx` (one already exists as `queryPayments()`'s `total`; the other is `filterPayments({}).length`) and passed in as props, so no extra fetch is needed just to show a number. The dialog builds the download URL client-side from the current filter query string plus `columns` and `scope`, and disables Download when zero columns are selected. The export route validates `columns` against `EXPORT_COLUMNS` server-side (dropping anything unrecognized, defaulting to every column except `last4` when the param is absent), picks `filterPayments(filters)` or `filterPayments({})` based on `scope`, and builds the filename from a small new `exportScopeLabel()` helper.

**Column order in the output:** the requested `columns` param is filtered against `EXPORT_COLUMNS`' canonical order rather than preserving whatever order the client sent. **Considered and rejected:** letting ops drag-reorder columns and preserving that order — the ticket only asks for column *choice*, not reordering, and a stable predictable header is more useful for a file ops re-imports into a spreadsheet than one that shuffles per export.

**Filename scope label:** `"all"` for the all-payments scope; for current-filter scope, the active `status` filter if one is set (matches the ticket's own example, `payments-disputed-2026-08-13.csv`), otherwise the literal string `"current"` (confirmed with the team — a merchant-only or unfiltered "current filter" export still reads as `payments-current-<date>.csv`, not `payments-all-...`, since "all payments" is a distinct, deliberate choice in the dialog).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add `DEFAULT_EXPORT_COLUMNS` (all columns minus `last4`), `parseExportColumns(param)` (allowlist + canonical order), `exportScopeLabel(scope, status)`; change `exportFilename(scopeLabel, date)` signature |
| `src/lib/csv.test.ts` | change | Extend with cases for `parseExportColumns` (subset, unknown columns dropped, empty), `exportScopeLabel`, and update the one `exportFilename` test for the new signature |
| `src/app/api/payments/export/route.ts` | change | Parse `scope` and `columns` from the query string, validate columns (400 if none survive), pick the filter set by scope, pass the scope label into `exportFilename` |
| `src/app/payments/export-dialog.tsx` | add | Client component: column checkboxes, scope radio with row counts, computed download `href`, disabled Download when no columns are checked |
| `src/app/payments/page.tsx` | change | Replace the bare Export `<a>` with `ExportDialog`, passing the current filter query string, `total` (current-filter count) and `filterPayments({}).length` (all-payments count) |

## Plan

1. **Extend `csv.ts`** — `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns()`, `exportScopeLabel()`, new `exportFilename()` signature. Done when: it type-checks and the module's existing exports (`EXPORT_COLUMNS`, `toCsv`) are unchanged.
2. **Extend `csv.test.ts`** — cover column subset/order/empty, scope label, updated filename test. Done when: `npx vitest run src/lib/csv.test.ts` passes.
3. **Update the export route** — scope + column parsing, 400 on an empty validated column set, scope-based row selection, new filename call. Done when: `curl localhost:3000/api/payments/export?columns=id,amount&scope=all` returns a 2-column CSV covering every payment, and `?columns=drop%20table` returns 400.
4. **Build `ExportDialog`** — checkboxes, scope radio with counts, disabled-when-empty Download. Done when: opening it in the browser shows `last4` unchecked, current-filter selected, and both row counts visible.
5. **Wire it into `page.tsx`** — swap the Export button, pass counts and filter query string. Done when: `/payments` in the browser opens the dialog from Export, and a default-state download omits `last4`.
6. **Full pass** — `npm test`, then manually exercise: switch scope and watch the count change, deselect every column and confirm Download disables, download with a status filter active and check the filename.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; `last4` off by default | `csv.test.ts` covers `parseExportColumns`/`DEFAULT_EXPORT_COLUMNS`; browser check confirms the checkbox starts unchecked |
| Scope choice (current filter / all payments), current filter default, row count visible pre-download | Browser check: open dialog, confirm current-filter is pre-selected and both counts render before clicking Download |
| Filename reflects scope and date | `csv.test.ts` covers `exportScopeLabel()` and the new `exportFilename()` signature |
| Amounts stay integer minor units, formatted once, currency in its own column | Already true in `toCsv`; existing `csv.test.ts` cases for the `amount`/`currency` columns keep passing unchanged |
| Deselecting every column disables Download, not an empty file | Browser check for the disabled state; route-level 400 on an empty validated column set as the server-side backstop |
| Unit test covers the column serializer, `npm test` passes | `npm test` run at the end of the plan |

## Risks

- No component-testing harness in this repo (no jsdom, no Testing Library) — the dialog's interactive behavior is verified manually, not by an automated test. Not adding one for this ticket; flagging so it isn't mistaken for an oversight.
- `filterPayments({}).length` for the all-payments count runs the full filter pass on every `/payments` page load even when the dialog is never opened. Negligible against an in-memory store at this data size; not worth a cache for 3 points of ticket scope.

## Out of scope

- NWP-102 (linked ticket) — whatever it covers stays untouched here.
- NWP-203 persistence — the store is in-memory by design; not touched.
- Column reordering, saved column presets, or scheduled/recurring exports — the ticket asks for choice, not customization beyond that.
- Exporting formats other than CSV.

## Open questions

None outstanding — the one ambiguity (filename label for an unfiltered or non-status "current filter" export) is resolved above: `"current"`.
