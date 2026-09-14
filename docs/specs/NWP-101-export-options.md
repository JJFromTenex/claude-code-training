# SPEC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** sachin-rafic
**Status:** building

## Problem

Ops exports the payments table several times a day and every file carries the card last-four, so anything bound for a merchant is hand-scrubbed first: 3–4 hours a month, and a near-miss last quarter where an unedited file nearly reached the wrong merchant. The Export button is fixed — every column, current filter only, no say in what comes out.

## Current state

- `src/app/payments/page.tsx` — the Export button is a plain `<a>` to `/api/payments/export?{query}`, where `query` is every truthy search param the page received. No client JavaScript is involved.
- `src/app/api/payments/export/route.ts` — `parseFilters` → `filterPayments` → `sortPayments` → `toCsv` → `Response` with `text/csv` and a `content-disposition` filename of `payments-YYYY-MM-DD.csv`. It deliberately skips `paginate`, so the export is already the whole filtered set, not the page on screen.
- `src/data/queries.ts` — `parseFilters` is the established allowlist boundary (status, sort, direction, page). `filterPayments`/`sortPayments`/`queryPayments` are the one query builder.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` (ten names), `cell()` (a switch with no default branch), `escapeCell()` (quotes on `"`, `,`, `\n`), and `toCsv(payments, columns)` which **already accepts a column subset in order**. Amount is formatted once via `formatMoney`; `currency` is already its own column.
- `src/lib/csv.test.ts` — eight tests pin escaping and column order. `vitest.config.ts` is Node-only, so anything under test must be pure.
- `src/components/Drawer.tsx` — the only `@radix-ui/react-dialog` wrapper. `.claude/rules/components.md` mentions a `Dialog` primitive; it does not exist, and there is no Checkbox component or dependency.

Where the ticket and the code disagree: the "current page only" warning describes a trap, not current behaviour. And there is no SQL to interpolate into — but an off-list column name reaching `cell()` would write `undefined` into every row, so the allowlist still earns its place.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate on the server … column names … checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md` §4 | `undefined` cells; header injection through the filename |
| "One query builder … a second implementation is a bug" | `merchant-console/CLAUDE.md` §3 | Export and table disagree on what a filter means |
| "Money is integer minor units … Format once, at the edge" | `merchant-console/CLAUDE.md` §1 | Cents drift; two formatters disagree |
| "Return the same error shape everywhere: a status code … and a body with a message safe to show a user" | `.claude/rules/api-routes.md` | Client cannot tell a bad request from a crash |
| "Use what is here … Tailwind only … Dialogs and forms must be operable" | `.claude/rules/components.md` | A new dependency, or a dialog keyboard users cannot leave |
| Card last-four is **off** by default | Ticket AC 1 | The near-miss happens again |

## Approach

Extend the serializer module with allowlisting parsers for `columns` and `scope`, a scope-aware filename built only from allowlisted tokens, and a CSV formula guard (cells beginning `=`, `+`, `@`, tab or CR get a leading apostrophe; `-` is left alone because refunds format as `-$5.00`). Teach the route to honour both params, rejecting bad input with 400, and to run the query builder with empty filters for scope `all`. Replace the `<a>` with a client `ExportDialog` built from the existing `Drawer`, with native labelled checkboxes and radios; the server page passes column metadata and both row counts as props, computed with `filterPayments(parseFilters(query)).length` over the exact query string the link will send, so the count on screen can never differ from the file.

**Considered and rejected:** fetching counts client-side from `GET /api/payments` (adds loading and error states for two numbers the server page already has); silently dropping unknown column names (a file that differs from what was asked for, with no signal); a new Dialog primitive plus Radix Checkbox (new code and a dependency for what `Drawer` already provides); parsing columns inside `parseFilters` (it returns `PaymentFilters`, and columns are not a filter); guarding `-` as a formula prefix (corrupts every negative amount).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Sensitive/default column sets, `parseExportColumns`, `parseExportScope`, scope-aware `exportFilename`, formula guard in `escapeCell` |
| `src/app/api/payments/export/route.ts` | change | Honour `columns` and `scope`, 400 on invalid, filename from allowlisted tokens |
| `src/app/api/payments/export/route.test.ts` | add | Boundary tests through `NextRequest`: defaults, 400s, scope, filename header |
| `src/app/payments/export-dialog.tsx` | add | Client drawer: columns, scope with counts, disabled Download when empty, reset on open |
| `src/app/payments/page.tsx` | change | Strip `page`, compute counts through the builder, render the dialog |
| `src/lib/csv.test.ts` | change | Column selection, filename, formula guard |

## Plan

1. **Serializer** — parsers, filename, guard in `src/lib/csv.ts` — done when: existing tests pass and `tsc` is clean.
2. **Route** — done when: `curl` returns the chosen header row, the scoped filename, and 400 for unknown or empty columns.
3. **Dialog and page** — done when: on `/payments` Export opens a drawer with last-four unchecked and the current-filter count shown; unchecking every column disables Download; Escape closes and focus returns.
4. **Tests** — `csv.test.ts` and `route.test.ts` — done when: `npm test` is green with the new cases.
5. **Gates** — `npm run lint`, `npx tsc --noEmit`, `/ship-ready` — done when: all clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last-four off by default | Unit tests on defaults and subsets; drawer opens with last-four unchecked; a request with no `columns` param has no `last4` header |
| Scope current filter or all; default current; count visible | Counts from the builder; `scope=all` row count ≥ filtered; each equals count + header |
| Filename reflects scope and date | Unit test; `curl -sI` shows `payments-disputed-YYYY-MM-DD.csv` and `payments-all-…`; shape regex |
| Amounts formatted once, currency in its own column | Existing `$250.00` and `"$1,234,567.89"` tests still pass; `cell` untouched |
| Deselecting every column disables Download | Manual; `columns=` returns 400 with a message |
| Column names validated server-side | `columns=id,drop_table` returns 400; route test |

## Risks

- The Drawer is a side sheet rather than a centred modal — same Radix semantics; a class change if a centred dialog is wanted later.
- The formula guard changes merchant-facing cells that begin with `=`, `+`, `@`, tab or CR. Excel shows the text; a plain-text viewer shows the apostrophe. Called out in the PR.

## Out of scope

- `sortPayments` compares amounts as strings (`queries.ts`), so `900` sorts above `10000`. Affects export order under `sort=amount`; flagged, not fixed here.
- No UTF-8 BOM, so `€`/`£` may mis-render in Excel. Flagged.
- `page.tsx` duplicates the `STATUSES` allowlist from `queries.ts`. Flagged.
- Persistence (NWP-203), daily totals (NWP-102), authentication, seed data.

## Open questions

- None blocking. Filename segment when the current filter has no status is `filtered`; a judgment call, easy to rename.
