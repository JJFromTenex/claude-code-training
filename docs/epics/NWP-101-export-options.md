# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Claude
**Status:** draft

## Problem

Ops exports the payments table several times a day, and every export ships every column — including the card last-four — whether or not the file is going to a merchant. Dana's team spends 3–4 hours a month manually scrubbing files by hand before they can be sent out, and a near-miss last quarter (an unedited file almost went to the wrong merchant) shows this is a live risk, not just a chore.

## Current state

- `src/lib/csv.ts` — `EXPORT_COLUMNS` is a fixed 10-column tuple including `last4`. `toCsv(payments, columns)` **already accepts a column subset** as an optional third… second argument, and the export route just never uses it. `cell()` formats `amount` via `formatMoney` once and `currency` is already its own column, so AC4 ("amounts stay in minor units internally, formatted once, currency in its own column") is already true in the serializer — it just has to survive the new UI/route wiring, not be built.
- `src/lib/csv.test.ts` — existing tests pin the escaping and column-subset contract. The DoD requires extending this file rather than starting a new one.
- `src/lib/money.ts` — `formatMoney(minorUnits, currency)` is the one formatter; nothing here should add a second one.
- `src/app/api/payments/export/route.ts` — calls `parseFilters` → `filterPayments` → `sortPayments` **unpaginated**, then `toCsv(rows)` with the default column set. It already avoids the bug the ticket warns about (browser-side export would only see the current page) because it re-runs the filter server-side without paginating. It does not yet read `columns` or `scope` from the query string.
- `src/app/api/payments/route.ts` + `src/data/queries.ts` — the one query builder: `parseFilters` (allowlists every param), `filterPayments`, `sortPayments`, `paginate`, `queryPayments`. `filterPayments({ status: "all" })` (no other filters) returns every payment, unpaginated — this is how both "all payments" scope and any row-count preview must be computed, through the existing builder.
- `src/app/payments/page.tsx` — server component. Renders the Export button as a plain `<a href="/api/payments/export?...">`. It already computes `total` (the current-filter row count, via `queryPayments`) and has `query`, the current filter's `URLSearchParams`, in scope.
- `src/app/payments/filter-bar.tsx` — the codebase's pattern for a client-side controls component (`"use client"`, builds its own `URLSearchParams`, calls `router.push`).
- `src/components/Drawer.tsx` — the only dialog primitive in the app (wraps `@radix-ui/react-dialog`). There is no separate `Dialog.tsx`.
- No `Checkbox.tsx` component exists. `DropdownMenuCheckboxItem` in `src/components/DropdownMenu.tsx` is a dropdown-menu item, not a form control, and isn't a fit for a dialog full of checkboxes.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Anything from the client — column names, currencies, statuses — is checked against an allowlist before it reaches a query, a filename, or the store | `.claude/rules/api-routes.md`, ticket notes | An unvalidated `columns` param interpolated anywhere near a query is an injection path |
| The one query builder behind `GET /api/payments` handles all payment filtering; a second implementation is a defect | `.claude/rules/api-routes.md`, ticket notes | "All payments" scope or a row-count preview built by hand-filtering `store.payments` duplicates logic and will drift from the real filter semantics |
| Reject early and return; deeply nested validation is where cases go missing | `.claude/rules/api-routes.md` | Invalid `columns`/`scope` silently falls through to a wrong or empty export |
| Amounts are integer minor units; format at the edge, once, next to their currency code | `.claude/rules/money.md`, merchant-console `CLAUDE.md` | Reformatting or re-parsing a formatted amount anywhere in the new dialog/route code corrupts the number |
| Dialogs and forms must be operable: every input labeled, accessible name, focus moves in and returns on close, Escape closes | `.claude/rules/components.md` | An unlabeled checkbox list or a focus trap makes the options dialog unusable for keyboard/screen-reader users |
| Format money in components, not upstream; components receive minor units + currency code | `.claude/rules/components.md` | N/A here — export formatting happens server-side in `csv.ts`, not in a component, which is already correct and must stay that way |
| Building the export in the browser only sees the current page, which is the bug being fixed, not shipped | ticket notes | An all-payments scope implemented by iterating loaded table rows would silently truncate to one page |

## Approach

Add a client-side options dialog (built on the existing `Drawer`) triggered from the current Export button. The dialog lets ops pick columns (checkboxes, `last4` off by default) and scope (current filter, default, or all payments), and shows the row count for whichever scope is selected — using totals already computable through the existing query builder, passed down from the server component. On Download, the dialog links to the existing export route with `columns` and `scope` added to the query string; the route (already the single place that filters and serializes) validates both against allowlists and does the actual work. No new filtering path is introduced anywhere.

**Considered and rejected:** fetching all matching rows into the browser and slicing/filtering there for the "all payments" vs. "current filter" choice. Rejected because it reintroduces exactly the pagination bug the ticket calls out ("current page only, which is the bug we would be shipping instead of the feature"), and because it would require a second, client-side reimplementation of filtering logic that already exists behind `GET /api/payments`.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Add a server-side column allowlist parser (validates a `columns` query value against `EXPORT_COLUMNS`), a `DEFAULT_EXPORT_COLUMNS` constant (all columns except `last4`) for the dialog's initial state, and a scope label parameter for `exportFilename` |
| `src/lib/csv.test.ts` | Change | Extend with cases for the column allowlist parser (valid subset, unknown column rejected, empty selection) and the filename's new scope label |
| `src/data/queries.ts` | Change | Expose the all-payments total by reusing `filterPayments`, not a new counting path |
| `src/app/api/payments/export/route.ts` | Change | Read and validate `columns` and `scope` from the query string; choose rows via the existing builder for either scope; 400 on an invalid/empty column list; build the filename with the resolved scope label |
| `src/app/payments/page.tsx` | Change | Compute the current-filter total (already has it) and the all-payments total; pass both plus the filter query string to the new dialog component; replace the anchor Export button with the dialog's trigger |
| `src/components/ui/payments/ExportOptionsDialog.tsx` | Add | Client component: `Drawer`-based dialog with labeled column checkboxes, a scope choice, a live row-count line, and a Download control that disables when no columns are selected and otherwise points at the validated export URL |

## Plan

1. **Add column validation + defaults to `csv.ts`, extend `csv.test.ts`** — done when: `npm test` passes with new cases covering a valid column subset, an unknown/invalid column being rejected, and an empty selection being rejected.
2. **Add the all-payments total to `queries.ts`** — done when: a call reusing `filterPayments` returns the full unfiltered payment count, exercised by a quick manual check (e.g. against seed data length) or a unit test if one already exists for `queries.ts`.
3. **Wire `columns` and `scope` into the export route** — done when: hitting `/api/payments/export?columns=id,amount&scope=all` returns a CSV with just those two columns and every payment regardless of the page's active filters, and an invalid `columns` value returns 400.
4. **Build `ExportOptionsDialog`** — done when: opening it from `/payments` shows every column checked except `last4`, "current filter" selected by default, a row count matching the page's visible total, keyboard focus moves in and Escape closes it.
5. **Wire the dialog into `page.tsx` and confirm the filename** — done when: choosing scope + columns and clicking Download produces a file named per the scope (`payments-<status>-<date>.csv` when a status filter is active, `payments-filtered-<date>.csv` for an unfiltered current-filter export, `payments-all-<date>.csv` for all-payments scope), containing exactly the selected columns.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose which columns are included; `last4` off by default | Manual: open the dialog, confirm every checkbox is checked except `last4`; unit test in `csv.test.ts` for the column parser |
| Ops can choose scope (current filter / all payments); current filter default; row count visible before download | Manual: toggle scope in the dialog, confirm the row-count line updates and matches the page total (current filter) vs. the all-payments total |
| Filename reflects scope and date, e.g. `payments-disputed-2026-08-13.csv` | Unit test in `csv.test.ts` for the scope-aware filename; manual download with a status filter active |
| Amounts stay in minor units internally, formatted once, currency in its own column | Already covered by existing `csv.test.ts` cases for `amount`/`currency` columns; confirm they still pass unchanged |
| Deselecting every column disables Download rather than producing an empty file | Manual: uncheck every box in the dialog, confirm Download is disabled; route-level unit/manual check that an empty `columns` value 400s |
| Unit test covers the column serializer; `npm test` passes | `csv.test.ts` extended per steps 1 and 5 above; run `npm test` |

## Risks

- A status-filter-derived filename means two quick exports with the same filter collide on name (already true of today's date-only filename per the existing `exportFilename` test — accepted as by-design, not new risk).
- Empty seed data (`store.payments` = 0) would show a 0 row count for both scopes; the dialog's disabled-Download behavior only guards on column selection, not row count, so a 0-row CSV (header only) can still be downloaded — matches `toCsv`'s existing "emits a header even with no rows" behavior and isn't an AC violation.

## Out of scope

- Column reordering via drag-and-drop — not requested; column order in the dialog can mirror `EXPORT_COLUMNS` order.
- Saved/named column presets — not requested.
- Export formats other than CSV — not requested.
- NWP-102 (linked ticket) — whatever it covers is separate work.

## Open questions

- None remaining. The filename's scope-label rule (status when a status filter is active, `filtered` for an unfiltered current-filter export, `all` for all-payments scope) was confirmed with Nisha before writing this epic.
