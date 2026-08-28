# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code, in plan mode, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Willy Lazari
**Status:** done

## Problem

Ops exports the payments table several times a day, and the file is always the same: every column, current filter only. The card last four is in every file, so anything going to a merchant is cleaned up by hand first. Dana's team puts that at 3 to 4 hours a month, and one unedited file nearly went to the wrong merchant last quarter.

## Current state

Every claim below was checked against the code.

- `src/app/payments/page.tsx:68-76` — Export is a plain anchor to `/api/payments/export?<every non-empty page param>`. No JavaScript, no options.
- `src/app/api/payments/export/route.ts` — `GET` runs `parseFilters`, then `sortPayments(filterPayments(filters))`, and deliberately skips `paginate()`. The server already returns every matching row.
- `src/data/queries.ts:18-36` — `parseFilters` is the existing allowlist: status against a fixed list, sort and direction narrowed, page coerced. Route handlers call it rather than reading params themselves.
- `src/data/queries.ts:45-70` — `filterPayments` is the one query builder.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` (10 names, including `last4`); `toCsv(payments, columns)` already accepts a subset in the given order; `exportFilename(date)` stamps the UTC date only. Amount goes through `formatMoney` once and `currency` is already its own column.
- `src/lib/csv.test.ts` — nine tests, with a note that NWP-101 changes which columns ship, not how a cell is written, and that they should still pass afterwards.
- `src/components/Drawer.tsx` — the accessible overlay this repo has, built on Radix Dialog. There is no `Dialog.tsx` and no checkbox primitive, despite `.claude/rules/components.md` listing a Dialog.

Where the ticket does not match the code:

- The pagination warning is about building the export in the browser. The server path is already unpaginated.
- Two acceptance criteria (amounts formatted once, currency in its own column) are already true and only need protecting.
- `page.tsx:36-43` builds its filters by hand and ignores `from`, `to`, `sort`, `direction`, while the old Export link forwarded every param and the route honoured them. Any row count shown in a dialog must be computed from the filters the page actually applied, or the count and the file disagree.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `merchant-console/CLAUDE.md`, ORG-STANDARDS #1, #2 | A formatter's output re-enters arithmetic; cents drift |
| One query builder | `merchant-console/CLAUDE.md`, ORG-STANDARDS #6 | A second filter path drifts from the first |
| Validate on the server against an allowlist | `.claude/rules/api-routes.md`, ORG-STANDARDS #7 | Client column names reach a query or a filename unchecked |
| Storage and bucketing are UTC | `merchant-console/CLAUDE.md`, ORG-STANDARDS #4 | The filename stamps the wrong day for anyone off UTC |
| Use the components that are here; dialogs must be operable | `.claude/rules/components.md` | A hand-rolled overlay with no focus handling or accessible name |
| Card data masked wherever it is not needed | ORG-STANDARDS #8 | The defect this ticket exists to remove |

## Approach

Two query params on the existing export route, `columns` and `scope`, both parsed on the server in `src/lib/csv.ts` against allowlists, in the same allowlist-then-default shape as `parseFilters`. The default column set is `EXPORT_COLUMNS` minus `last4`; the policy lives in the parser and the dialog, not in `toCsv`'s default, so the existing tests stay green untouched. `scope=all` is the same `filterPayments` call with the filters cleared, so there is still one builder. The filename gains a scope word derived only from literals or an already-allowlisted status. The UI is the existing `Drawer` with native checkboxes and radios inside labels; it computes nothing, receives both row counts from the server page, and builds a URL.

**Considered and rejected:**

- Building the CSV in the browser from the rows on screen. It is the paginated-page bug the ticket names.
- Adding a `Dialog.tsx` primitive. `Drawer` is the Radix Dialog this repo already has; a second overlay is what `components.md` warns against.
- Changing the amount cell to a symbol-free `250.00`. It would need a second formatter (`money.md` forbids one) and rewrite two pinned tests. Decided with the reporter: keep `$250.00`.
- A `/api/payments/count` endpoint for the row counts. The server page already has one of the two totals; the other is one more `queryPayments` call.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, `parseExportScope`, `exportScopeLabel`, scoped `exportFilename` |
| `src/lib/csv.test.ts` | Change | Extend with the new parsers and filename; the ticket says extend, not start a new file |
| `src/app/api/payments/export/route.ts` | Change | Parse and validate both params, refuse an empty selection with 400, honour scope, name the file |
| `src/app/payments/export-dialog.tsx` | Add | Client component: scope radios, column checkboxes, live row count, Download that disables |
| `src/app/payments/page.tsx` | Change | Compute the all-payments total, replace the anchor with the dialog |

## Plan

1. **Parsers and filename in `csv.ts`** — done when: `parseExportColumns(null)` has no `last4`, unknown and duplicate names drop, request order is kept, and the nine existing tests pass unchanged.
2. **Tests in `csv.test.ts`** — done when: subset order, last four off by default, empty selection, scope, label, and scoped filename are each covered and green.
3. **Route handler** — done when: `columns=` gives 400, `scope=all` ignores filters, the filename carries the scope, `curl` confirms each.
4. **Dialog and page** — done when: the drawer opens with `last4` unticked, the count follows the scope radio, Download disables when nothing is ticked, `tsc` and lint are clean.
5. **Rebuild and restart** — done when: the production build serves the new route and page.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last four off by default | Export with no `columns` param: header has no `last4`. With `columns=amount,id`: header is exactly that, in that order |
| Scope current or all; current default; row count visible | `status=disputed` returns 33 rows and the page shows 33; `scope=all` returns 1,657. Counts in the drawer come from the same `queryPayments` |
| Filename reflects scope and date | `content-disposition` reads `payments-disputed-<date>.csv`, `payments-all-<date>.csv`, `payments-filtered-<date>.csv` |
| Minor units internally, formatted once, currency its own column | Existing csv tests unchanged and green; `formatMoney` called once in `cell()` |
| Deselecting every column disables Download; never an empty file | `columns=` and `columns=bogus` get 400; the button is disabled in the drawer |
| Column names validated server-side | `parseExportColumns` allowlist; a broken allowlist makes two tests fail |
| Reuse the query builder | Route still calls `filterPayments` and `sortPayments`; the dialog only builds a URL |

## Risks

- The drawer slides in from the side rather than sitting centred. Accepted: it is the accessible overlay this repo has.
- The export must keep skipping `paginate()`. Routing it through `queryPayments` for tidiness would reintroduce the bug the ticket warns about.
- The filename is built from validated values only. Interpolating a raw param there is the failure the ticket names.

## Out of scope

- `src/data/queries.ts:81` sorts amounts as text. A real defect, fixed on its own branch, not here.
- `page.tsx` ignoring `from`, `to`, `sort`, `direction`. Neutralised for the export by building the URL from the page's own filters; the page is not changed.
- `escapeCell` not neutralising a leading `=`, `+`, `-`, `@`. Every value is generated today.
- Persistence. The store is in memory on purpose; that is NWP-203.

## Open questions

- None open. One was settled before building: keep the `$250.00` amount cell rather than a bare `250.00`.
