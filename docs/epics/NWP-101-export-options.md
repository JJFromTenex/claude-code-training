# EPIC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** padmil
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and every file comes out the same: every column, current filter only. The card last-four is in all of them, so anything going to a merchant is hand-cleaned first. That is 3–4 hours a month of spreadsheet editing, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

The export is already a server route that reuses the query builder. Most of this ticket is control, not plumbing.

- `src/app/api/payments/export/route.ts:11-24` — the export route exists, calls `parseFilters` → `filterPayments` → `sortPayments`, and streams CSV with a `content-disposition` filename. Its own comment names NWP-101 as the ticket for column and scope control.
- `src/lib/csv.ts:58-67` — `toCsv(payments, columns)` **already takes a column list**, defaulting to `EXPORT_COLUMNS` (`csv.ts:13-24`). The serializer is largely done; what is missing is a validated column list reaching it.
- `src/lib/csv.ts:69-71` — `exportFilename(date)` stamps the date only. No scope segment.
- `src/app/payments/page.tsx:68-76` — Export is a plain `<a>` to `/api/payments/export?<current query>`. There is no dialog and no client component to hang one on.
- `src/data/queries.ts:18-36` — `parseFilters` is the existing allowlist boundary for status, sort and direction. It knows nothing about columns or scope, and it never reads `pageSize` even though `PaymentFilters` declares it (`src/data/types.ts:80`).
- `src/data/queries.ts:45-70, 87-99` — `filterPayments` returns the whole filtered set; `paginate` is a separate step. An unpaginated export is already the default path, and "all payments" is the same call with filters cleared.
- `src/app/payments/page.tsx:45,142` — the filtered row count (`total`) is already computed on the page and rendered in the footer.
- `src/lib/csv.test.ts` — nine tests pin escaping and the column contract. The file comment states NWP-101 changes *which* columns ship, not how a cell is written, and these should still pass.

**Where the ticket and the docs do not match the code:**

- The ticket warns "there is already a query builder behind `GET /api/payments`, reuse it." `src/app/api/payments/export/route.ts:12-17` already does. The warning describes a trap to avoid, not a defect to repair.
- `.claude/rules/components.md` lists a `Dialog` among existing components. **There is no `src/components/Dialog.tsx`.** `src/components/Drawer.tsx:3` is built on `@radix-ui/react-dialog` and is the closest thing that exists. Decision: reuse `Drawer`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate everything from the client against an allowlist before it reaches the store, a query, or a filename. Column names, currencies, statuses, sort fields, page sizes." | `.claude/rules/api-routes.md` | A client-supplied column name reaches a query or a filename unchecked |
| "Reuse the query builder. Payment filtering goes through the one behind `GET /api/payments`. Writing a second filter path is a defect." | `.claude/rules/api-routes.md` | The export and the table disagree about what "current filter" means |
| Money is integer minor units; "Format at the edge, in the component that renders it, and nowhere else." | `.claude/rules/money.md` | Cents drift, or a formatted string gets stored |
| "Dialogs and forms must be operable... focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Ops cannot drive the dialog from the keyboard |
| Card last-four is **off** by default | ticket AC 1 | The exact failure that caused last quarter's near-miss |

## Approach

Extend the export route that already exists rather than adding a second path. `EXPORT_COLUMNS` becomes the server-side allowlist: the route reads a `columns` param, intersects it with that constant, drops anything unrecognised, and hands the survivors to `toCsv`, which already accepts them. A `scope` param of `current` or `all` decides whether the parsed filters are applied or discarded before `filterPayments`. The dialog is a new client component on `/payments` that collects columns and scope and then navigates to the same export URL with those two extra params — so the download stays a plain GET and no fetch/blob handling is needed. Row counts are passed in from the server page as props, since the filtered `total` is already computed at `page.tsx:45`.

**Considered and rejected:** building the CSV in the browser from the rendered table. It touches one component and needs no server change, but `page.tsx:45` only holds the twenty rows of the current page (`PAGE_SIZE`, `queries.ts:43`), so it would export one page and call it an export — the exact bug the ticket says we would be shipping instead of the feature. Also rejected: a new count endpoint for the dialog, because `total` already exists on the page and a second count path would drift from the first.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Column allowlist/validator and default set (last4 off); `exportFilename` gains a scope segment |
| `src/lib/csv.test.ts` | change | Extend with serializer and filename cases — DoD says extend this file, not start a new one |
| `src/app/api/payments/export/route.ts` | change | Parse and validate `columns` and `scope`; skip filters when scope is `all` |
| `src/app/payments/export-dialog.tsx` | add | Client component on `Drawer`: column checkboxes, scope choice, row count, Download |
| `src/app/payments/page.tsx` | change | Replace the `<a>` at `:68-76` with the dialog; pass filtered and unfiltered totals |

## Plan

1. **Column allowlist and defaults in `src/lib/csv.ts`** — done when: an unknown column name is dropped rather than emitted, the default set is every column except `last4`, and unit tests cover both.
2. **Scope in `exportFilename`** — done when: scope `disputed` and `2026-08-13` produce `payments-disputed-2026-08-13.csv`, and the existing unscoped test at `csv.test.ts:81-83` still passes.
3. **Route accepts `columns` and `scope`** — done when: `/api/payments/export?columns=id,amount&status=disputed` returns two columns of disputed rows; a junk column name is ignored rather than echoed; `scope=all` returns all ~1,680 rows (`generate.ts:17-18`) regardless of filters.
4. **Dialog on `Drawer`** — done when: Export opens it, `last4` is unchecked on open, Escape closes it, focus returns to the button, and Download is disabled with nothing selected.
5. **Wire the counts and swap the button** — done when: the current-filter count in the dialog matches the footer at `page.tsx:142`, and the all-payments count is shown beside the other option.
6. **`npm test`** — done when: it passes, including the nine pre-existing `csv.test.ts` cases.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns choosable, last4 off by default | Unit test on the default set in `csv.test.ts`; open the dialog and confirm `last4` is unchecked |
| Scope choice, current filter default, row count visible | Filter to `disputed`, open the dialog: current filter is preselected and its count matches `page.tsx:142` |
| Filename reflects scope and date | Unit test on `exportFilename` with a scope; download under a status filter and read the saved name |
| Amounts formatted once, currency in its own column | Existing `csv.test.ts:32-41` still passes unchanged; `formatMoney` stays the only formatter |
| No columns disables Download | Uncheck every box in the dialog and confirm Download is disabled and no request fires |

## Risks

- `sortPayments` compares amounts as text (`src/data/queries.ts:80-81`, flagged in-file as a planted bug), so an amount-sorted export comes out misordered. **Not this ticket.** Do not fix it here; note it in the PR.
- `page.tsx:36-43` parses only status, merchantId, search and page, while `parseFilters` also accepts `from`, `to`, `sort` and `direction`. "Current filter" can therefore mean two different things. Pass the page's existing query string through untouched rather than rebuilding it in the dialog.
- The filename's scope segment is influenced by client input. Derive it from the **validated** filters, never from a raw param, or the allowlist rule is defeated at the filename instead of at the query.

## Out of scope

- Fixing the amount sort bug — it belongs with the diagnosis work in [NWP-102](../tickets/NWP-102.md).
- Changing how a cell is written (escaping, money format). `csv.test.ts` says explicitly that NWP-101 should leave that alone.
- XLSX output, scheduled or emailed exports, and saved column presets.
- Adding a `Dialog` component to make `.claude/rules/components.md` accurate. Worth its own ticket; not worth a 3-pointer's clock.

## Open questions

- Which columns are on by default beyond last4 being off? **Assumed:** every column except `last4`.
- Does `scope=all` clear the date range too, or only status/merchant/search? **Assumed:** all filters cleared — "all payments" should mean all payments.
- At ~1,680 rows an all-payments export needs no warning or confirm step. If the seed grows or this ever points at real volume, that assumption needs revisiting.
