# EPIC · NWP-101 — Payments export: choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** sdeshpande
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and the export is fixed: every column, current filter only, no say in what comes out. The card last-four is in every file, so anything going to a merchant is cleaned up by hand first: 3–4 hours a month of spreadsheet editing, and a near-miss last quarter where an unedited file nearly went to the wrong merchant.

## Current state

The export already exists and is closer to done than the ticket implies.

- `src/app/api/payments/export/route.ts:11-25` — the export route. It already calls `parseFilters`, `filterPayments`, and `sortPayments`, so it honors the active filters and reuses the query builder. Its own comment at `:8-9` names the gap: "the column set and the scope are fixed. Giving ops control over both is NWP-101."
- `src/lib/csv.ts:13-24` — `EXPORT_COLUMNS`, the ten-column allowlist, with the `ExportColumn` type at `:26`. **This is already the server-side allowlist the ticket asks for.**
- `src/lib/csv.ts:58-61` — `toCsv` already takes an optional `columns` argument and honors order. Column selection is plumbing an allowlisted param through, not a new serializer.
- `src/lib/csv.ts:69-71` — `exportFilename` stamps only the date: `payments-2026-03-14.csv`. No scope segment.
- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?...">` carrying the current query string. No dialog, and the page is a server component.
- `src/data/queries.ts:18-36` — `parseFilters` allowlists `status`, `sort`, `direction`, and `page`. It reads no `columns` and no `scope`; that is the extension point.
- `src/data/queries.ts:87-106` — `paginate`/`queryPayments` already return `total`, and `src/app/payments/page.tsx:45,142` already renders it. The filtered row count is in hand.

**Where the ticket does not match the code:**

- *"Building this in the browser exports the current page only, which is the bug we would be shipping."* The route is already server-side and already unpaginated (`filterPayments`, not `queryPayments`). The trap is only live if the new dialog builds the file from `rows` in `page.tsx:45`, which is one page of `PAGE_SIZE = 20` (`src/data/queries.ts:43`).
- *"Reuse the query builder rather than writing a second one."* Already satisfied at `export/route.ts:12-17`. Preserve it; nothing to fix.
- **AC4 contradicts the pinned tests.** `src/lib/csv.test.ts:34,40` pin the amount cell as `$250.00` and `"$1,234,567.89"` — symbol embedded, comma forcing a quoted cell — while `currency` is already its own column. That file's comment at `:5-10` claims NWP-101 "changes which columns ship, not how a cell is written." **Decided: amount becomes a bare `250.00`, currency stays in the `currency` column.** Those two assertions get rewritten and that comment is now wrong.
- `.claude/rules/components.md` says `src/components/` "already has Button, Input, Select, **Dialog**, Badge." There is no `Dialog.tsx`. The only thing built on `@radix-ui/react-dialog` is `src/components/Drawer.tsx:3`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`... Format once, at the edge, next to its currency code." | `CLAUDE.md` conv. 1 | Cents drift; totals disagree between table and file |
| "Format at the edge, in the component that renders it, and nowhere else." | `.claude/rules/money.md` | Two formatters, two answers |
| "Validate everything from the client against an allowlist before it reaches the store, a query, **or a filename**." | `.claude/rules/api-routes.md` | Client-chosen text reaches a filename or a query unchecked |
| "Reuse the query builder. Writing a second filter path is a defect." | `.claude/rules/api-routes.md` | Export and table disagree about what matches |
| "Dialogs and forms must be operable" — labels, accessible name, focus in and back, Escape closes | `.claude/rules/components.md` | Ops cannot drive it by keyboard |
| "Use what is here... before adding a dependency or hand-rolling a control." | `.claude/rules/components.md` | A third dropdown implementation |
| Card last-four off by default | Ticket AC1 | The near-miss happens again, for real |

## Approach

Keep the export server-side and keep the single query path. Add two allowlisted params — `columns` (repeatable, validated against `EXPORT_COLUMNS`) and `scope` (`filter` | `all`) — parsed in `parseFilters` in `src/data/queries.ts` alongside the existing ones, so validation stays in one place and the route handler keeps not reading params itself. `scope=all` means "ignore the filters", which is the query builder called with empty filters, not a second code path. The dialog is a client component next to `filter-bar.tsx`; it renders checkboxes over `EXPORT_COLUMNS`, a scope radio with both row counts passed down from the server component, and a Download link whose `href` it assembles from the current query string. Amount formatting moves to a new bare-decimal formatter in `src/lib/money.ts`, used only by the CSV serializer.

**Considered and rejected:** generating the CSV in the browser from the table's `rows`. It needs no new API surface and would demo fine — and it would export 20 rows of 1,658, which is precisely the bug the ticket warns about. Also rejected: a `Dialog.tsx` built fresh on `@radix-ui/react-dialog`. `Drawer.tsx` already wraps that primitive with focus and Escape handling; reaching for it beats a second wrapper, even though the ticket says "dialog."

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/queries.ts` | change | Parse and allowlist `columns` and `scope` in `parseFilters`; resolve `scope=all` to empty filters |
| `src/data/types.ts` | change | Add `columns` and `scope` to `PaymentFilters` |
| `src/lib/csv.ts` | change | Amount cell to bare decimal; `exportFilename` takes an optional scope segment |
| `src/lib/money.ts` | change | Add the bare-decimal formatter — minor units to `250.00`, no symbol |
| `src/lib/csv.test.ts` | change | Rewrite the two amount assertions; cover column subset/order, empty selection, scope in filename |
| `src/lib/money.test.ts` | change | Cover the new formatter: negatives, zero, no thousands separator |
| `src/app/api/payments/export/route.ts` | change | Pass validated columns through; 400 on an empty column set |
| `src/app/payments/export-dialog.tsx` | **add** | The dialog: column checkboxes, scope radio, row counts, Download |
| `src/app/payments/page.tsx` | change | Swap the `<a>` at `:68-76` for the dialog; pass both row counts down |

## Plan

1. **Bare-decimal formatter in `money.ts`, with tests** — done when: `npm test` passes and no CSV code has changed yet.
2. **Point the amount cell at it; rewrite the two pinned assertions** — done when: `src/lib/csv.test.ts` is green and a manual `/api/payments/export` hit shows `250.00,USD`.
3. **`exportFilename` takes a scope segment** — done when: it produces `payments-disputed-2026-08-13.csv`, and the existing no-argument test at `csv.test.ts:79-84` still passes.
4. **Allowlist `columns` and `scope` in `parseFilters`** — done when: `?columns=id&columns=bogus` yields only `id`, and `?scope=all` returns every payment while `scope=filter` respects the status filter.
5. **Route returns 400 on an empty column set** — done when: `?columns=` is a 400 with a user-safe message, not a header-only file.
6. **Build the dialog; wire the Export button** — done when: both counts are visible before download, last-four starts unchecked, Download disables at zero columns, and Escape closes with focus back on the trigger.
7. **Full pass** — done when: `npm test` is green and the five ACs are each demonstrated in the browser.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns selectable, last-four off by default | Unit test on `toCsv` column subset + order; open the dialog and confirm `last4` unchecked |
| Scope filter/all, filter default, count visible first | Unit test that `scope=all` ignores filters; filter to Disputed and read both counts in the dialog |
| Filename reflects scope and date | Unit test on `exportFilename` with a scope; check `content-disposition` on a real download |
| Minor units internally, formatted once, currency own column | Unit tests on the new formatter and the amount cell; grep that `formatMoney` has no callers in `src/lib/csv.ts` |
| Empty selection disables Download | Deselect all in the dialog — button disabled; `?columns=` direct-hit returns 400 |

Command for all of it: `npm test` from `build-battle/merchant-console`. Then `/ship-ready`.

## Risks

- **`sortPayments` sorts amounts as strings.** `src/data/queries.ts:79-82` compares `String(a.amount)` lexicographically, so `sort=amount` orders 1000 before 900 — and the export inherits it via `export/route.ts:13-17`. Not this ticket, but the exported row order is wrong today. Raise separately rather than fixing it here.
- **`scope=all` is 1,658 rows and every currency.** Mixed-currency files are fine per-row since currency has its own column, but nobody should sum the amount column across the file.
- **The "format at the edge" rule assumes a component.** For a CSV the edge is the serializer. Keeping the formatter in `money.ts` and calling it only from `csv.ts` honors the intent; putting it in `csv.ts` would be a second formatter.
- **`PaymentFilters.pageSize` is in the type (`src/data/types.ts:81`) and read at `queries.ts:105`, but `parseFilters` never sets it.** Pre-existing; do not "fix" it in passing.

## Out of scope

- Persistence of column presets — no store writes; persistence is NWP-203 and the store is in-memory by design.
- The amount-sort defect above.
- Export formats other than CSV, and anything on `/disputes` or `/payouts`.
- Adding a `Dialog.tsx` to `src/components/` to match what `components.md` claims exists.

## Open questions

- **What is the scope segment when scope is `all`?** The ticket's example is `payments-disputed-2026-08-13.csv`, derived from a status filter. Assuming `payments-all-2026-08-13.csv`, and `payments-2026-08-13.csv` when scope is `filter` with no filters set. Worth 30 seconds with Dana.
- **Does a merchant filter belong in the filename too** (`payments-lumen-disputed-...`), or is status enough? Assuming status only, since merchant names would need slugifying and that is client-derived text reaching a filename.
- The date in the filename is the export date, not the filter range. The ticket's wording ("the scope and the date") reads that way; confirm before Finance assumes otherwise.
