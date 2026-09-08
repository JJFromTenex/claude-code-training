# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before the code, updated as it was built.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Linnea Castro
**Status:** complete — committed on `NWP-101-export-options`, PR open

## Problem

Ops exports the payments table several times a day and gets the same fixed file every
time: every column, current filter only. The card last-four rides along in all of them,
so anything going to a merchant is cleaned up by hand first — Dana's team puts that at
3–4 hours a month, plus a near-miss last quarter where an unedited file nearly went to
the wrong merchant.

## Current state

- `src/app/api/payments/export/route.ts` — calls `parseFilters` → `filterPayments` →
  `sortPayments` → `toCsv`, then sets `content-disposition`. It deliberately skips
  `paginate()`, so **the export already returns the full filtered set, not one page**.
- `src/lib/csv.ts` — `toCsv(payments, columns)` already accepts a column subset and
  defaults to `EXPORT_COLUMNS`. Nothing ever passed one. The serializer was most of the
  way there before this ticket.
- `src/data/queries.ts:18` — `parseFilters` is the existing allowlist boundary
  (`status`, `sort`, `direction`, `page`). The new column and scope allowlists follow it.
- `src/app/payments/page.tsx:68` — the Export button was a plain `<a href>` carrying the
  current querystring. No client state, no fetch.
- `src/components/Drawer.tsx` — the codebase's dialog primitive, on `@radix-ui/react-dialog`.
  There is no `Dialog.tsx`, despite what `.claude/rules/components.md` implies.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `merchant-console/CLAUDE.md` | Cents drift on every total |
| Validate client input against an allowlist before a query, a filename, or the store | `.claude/rules/api-routes.md` | Column names from the client reach a serializer or a filename unchecked |
| One query builder, behind `GET /api/payments` | `merchant-console/CLAUDE.md` | Table and export disagree about what "disputed" means |
| Storage and bucketing are UTC | `merchant-console/CLAUDE.md` | The date stamp on a file depends on where the server runs |
| Dialogs are operable: accessible name, labels, focus, Escape | `.claude/rules/components.md` | Ops cannot drive the dialog by keyboard |

## Approach

Keep every decision on the server. The dialog is a form that builds a URL; the route
does the validating, the filtering, and the naming. Column names arrive as a comma list,
get matched against `EXPORT_COLUMNS`, and an empty match is a 400 rather than an empty
file. Row counts are computed in the server component and passed down as props.

**Considered and rejected:** building the CSV in the browser from the rows already on
screen. It is less code and it is the bug the ticket warns about — the table is
paginated, so it would export 20 rows and look correct. Rejected outright. A second
rejected option was fetching the counts client-side on dialog open; the server component
already has the query builder in hand, so a fetch would add a loading state and a second
filter path for nothing.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, scope in `exportFilename` |
| `src/app/api/payments/export/route.ts` | change | Validate `columns` and `scope`, 400 on empty, scope the filters and the filename |
| `src/app/payments/export-dialog.tsx` | add | The options dialog |
| `src/app/payments/page.tsx` | change | Compute both row counts, render the dialog |
| `src/lib/csv.test.ts` | change | Extend, per the DoD — do not start a new file |

## Plan

1. **Serializer and allowlist** — done when: `parseExportColumns` drops unknown names,
   dedupes, preserves requested order, and returns `[]` for an empty selection.
2. **Route** — done when: `?columns=` returns 400 with `{ message }`, `?scope=all`
   ignores the filters, and the filename carries the scope.
3. **Dialog** — done when: `last4` starts unchecked, both counts render, and clearing
   every column disables Download.
4. **Tests** — done when: `npm test` passes with no pre-existing test modified.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops chooses columns; last-four off by default | `DEFAULT_EXPORT_COLUMNS` excludes `last4` (unit test); default export contains no `4242` (curl); checkbox unchecked on open (browser) |
| Scope current-filter vs all, row count visible first | Scope labels read "Current filter (33 payments)" / "All payments (1,658 payments)"; both match `/api/payments` `total` exactly |
| Filename reflects scope and date | `payments-disputed-2026-09-08.csv`, `payments-all-2026-09-08.csv` (curl, content-disposition) |
| Amounts in minor units, formatted once, currency its own column | `cell()` holds minor units and calls `formatMoney` once at the boundary; `currency` is a separate column — unchanged from before this ticket |
| Empty selection disables Download | Download button `disabled: true` with inline error at 0 columns (browser); server returns 400 regardless (curl) |
| Not paginated | 33 rows returned where `PAGE_SIZE` is 20 |

Result: **36 tests passing** (was 28), typecheck clean, lint clean.

## Risks

- The filename is built from `filters.status` and the scope literal. Both are
  allowlisted, so nothing client-controlled reaches it — but that property has to hold
  if a future ticket adds a filter to the name.
- `scope=all` deliberately ignores every filter. If ops expects "all" to mean "all rows
  matching my merchant filter", the label is wrong, not the code.

## Out of scope

- `src/data/queries.ts:81` sorts amounts lexicographically —
  `String(a.amount).localeCompare(String(b.amount))` — so `9000` ranks above `25000` in
  both the table and the export. Real defect, linked ticket NWP-102, not touched here.
- `src/data/metrics.ts:25` buckets by server-local time and accumulates in floats.
  Same story; `lib/dates.ts` already exports `utcDayKey` for it.
- Persistence — NWP-203.

## Decisions

- **`DrawerHeader`'s close button had no accessible name** (`src/components/Drawer.tsx:113`) —
  an `aria-hidden` icon inside a bare `<Button>`, so screen readers announced it as
  "button". Pre-existing in a shared primitive, but `export-dialog.tsx` is the app's
  only consumer of `DrawerHeader`, so the gap reaches users for the first time through
  this feature. **Fixed here**, one line matching the existing idiom
  (`<span className="sr-only">Close</span>`, as in `Sidebar.tsx:224`). Widening the diff
  was judged cheaper than shipping a dialog that violates the operability rule this spec
  already binds itself to, and there is no second consumer to regress.
