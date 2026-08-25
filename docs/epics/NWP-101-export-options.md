# EPIC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Leandro Santana (with Claude)
**Status:** building

## Problem

Ops exports the payments table several times a day, but the export is fixed: every column, current filter only. The card last-four is in every file, so anything sent to a merchant is hand-cleaned first — 3–4 hours a month, and one near-miss where an unedited file nearly went to the wrong merchant.

## Current state

- `src/app/payments/page.tsx` — the Export button is a plain `<a href="/api/payments/export?…">` carrying the current filter query string. No dialog.
- `src/app/api/payments/export/route.ts` — validates via `parseFilters`, reuses `filterPayments` + `sortPayments` from `src/data/queries.ts` (deliberately skipping `paginate`, so all matching rows export), then `toCsv(rows)`.
- `src/lib/csv.ts` — `toCsv(payments, columns = EXPORT_COLUMNS)` **already accepts a column subset in order**; `EXPORT_COLUMNS` is the allowlist. `exportFilename(date)` produces `payments-YYYY-MM-DD.csv` with no scope label. Amounts formatted once here via `formatMoney`; currency is already its own column.
- `src/lib/csv.test.ts` — pins escaping and the column contract, including `exportFilename(date)`'s current signature. Extend, don't break.
- `src/components/` — `Drawer` (Radix dialog, accessible) is the in-repo dialog; no Checkbox/Radio components exist, so native inputs styled with Tailwind.
- Ticket vs code: "do not interpolate them into SQL" — there is no SQL; the real risk here is the filename and the store query, and the allowlist covers both.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate everything from the client against an allowlist" (columns, scope) | `.claude/rules/api-routes.md` | Client-trust defect; unvalidated value reaches a filename |
| "Reuse the query builder" | ticket, `CLAUDE.md` | Second filter path defect |
| "Amounts stay in minor units internally and are formatted once on the way out" | ticket | Cents drift |
| Browser-side export would export the current page only | ticket notes | The bug shipped instead of the feature |
| Last-four **off** by default | ticket | The near-miss recurs |

## Approach

Server first: `csv.ts` gains `DEFAULT_EXPORT_COLUMNS` (everything except `last4`) and `parseExportColumns` — comma-separated client input checked against `EXPORT_COLUMNS`, order preserved, duplicates dropped, unknown or empty → `null`. `exportFilename` gains an optional scope label (`payments-disputed-2026-08-13.csv`) sourced only from allowlisted values, keeping the existing call signature valid. The export route rejects bad columns with 400, reads `scope=filtered|all` (unknown falls back to `filtered`, matching `parseFilters` style), and passes empty filters when scope is `all`. Then the UI: the Export button opens a Drawer with column checkboxes (last4 off by default, with a note on why), a scope choice showing live row counts fetched from the existing `GET /api/payments` (reusing its `total` — no new count endpoint), and a Download button disabled at zero columns that navigates to the export URL.

**Considered and rejected:** building the CSV client-side from the table — exports only the visible page of 20 (the ticket names this as the bug). Also rejected: a dedicated count endpoint — `GET /api/payments` already returns `total` through the one query builder.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, scope label in `exportFilename` |
| `src/lib/csv.test.ts` | Change | Cases: subset in requested order, last4 excluded by default, empty selection |
| `src/app/api/payments/export/route.ts` | Change | Validate columns/scope, 400 on bad columns, labelled filename |
| `src/app/payments/export-dialog.tsx` | Add | Client drawer: checkboxes, scope + row counts, disabled Download |
| `src/app/payments/page.tsx` | Change | Swap the plain link for the dialog |

## Plan

1. **Server: csv.ts parsing + filename, route validation** — done when: curl shows subset ordering, 400 on `columns=`, 400 on unknown column, last4 absent by default, `scope=all` ignoring filters, filename carrying the scope label.
2. **Dialog** — done when: opening shows counts, unchecking all disables Download, download honors selections.
3. **Tests** — done when: new cases in `csv.test.ts` pass alongside the existing ones.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns, last4 off by default | curl default export has no last4 column; dialog checkbox unticked |
| Scope choice, current filter default, count visible | dialog shows totals from `GET /api/payments`; curl `scope=all` vs filtered row counts differ |
| Filename reflects scope and date | curl `-i` content-disposition shows `payments-disputed-…` / `payments-all-…` |
| Minor units internally, formatted once, currency column | unchanged path through `formatMoney` in `toCsv`; existing tests |
| Empty selection disables Download | button disabled in UI; server independently 400s `columns=` |

## Risks and out of scope

- **Risk:** breaking the pinned `exportFilename(date)` test — avoided by adding the label as a second optional parameter.
- **Out of scope:** changing cell escaping or the export's sort; NWP-102.
