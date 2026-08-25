# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** suniel12
**Status:** reviewed

## Problem

Dana Whitfield's ops team exports the payments table several times a day for merchant
queries, month-end reconciliation, and Finance requests. The file is fixed: every column,
current filter only. The card last four is in every file, so anything going to a merchant
gets hand-cleaned first. That is 3 to 4 hours a month of spreadsheet editing, plus a
near-miss last quarter where an unedited file nearly went to the wrong merchant.

## Current state

- `src/app/payments/page.tsx:68-77` — Export is a plain `<a href="/api/payments/export?{query}">`
  wrapped in `Button asChild`. It carries the current filter query string and nothing else.
  The page already computes `total` for the current filter at line 45 via `queryPayments`.
- `src/app/api/payments/export/route.ts` — calls `parseFilters()`, `filterPayments()`,
  `sortPayments()`, then `toCsv(rows)` and `exportFilename()`. It does **not** call
  `paginate()`, so it already exports the full result set. Column set and scope are hardcoded.
- `src/lib/csv.ts:13-24` — `EXPORT_COLUMNS`, a fixed 10-name list. Its own comment names
  NWP-101 as the ticket that changes it.
- `src/lib/csv.ts:58-67` — `toCsv(payments, columns = EXPORT_COLUMNS)` **already accepts a
  columns argument**. No caller passes one. Half the feature is present and unused.
- `src/lib/csv.ts:51-52` — the `amount` cell calls `formatMoney()`, which embeds a currency
  symbol. `currency` is a separate column already, so today the symbol is duplicated data.
- `src/lib/csv.ts:69-71` — `exportFilename(date)` ignores scope entirely.
- `src/data/queries.ts:18-37` — `parseFilters()` allowlists `status`, `sort`, `direction`, `page`.
  It does **not** know about columns or scope; those are new params this ticket adds.
- `src/data/queries.ts:45-70` — `filterPayments()`, the one builder. Calling it with
  `{ status: "all" }` and nothing else returns every payment, which is exactly "all payments" scope.
- `src/lib/money.ts:15-27` — `formatMoney(minorUnits, currency)`. No symbol-free variant exists.
- `src/lib/csv.test.ts` — 8 `toCsv` cases plus 1 `exportFilename` case, already covering
  escaping, merchant fallback, null card, and empty rows.
- `src/components/` — has `Drawer.tsx` (built on `@radix-ui/react-dialog`), `Button`, `Input`,
  `Select`, `DropdownMenu`. There is **no** `Dialog.tsx` and **no** `Checkbox.tsx`, despite
  `.claude/rules/components.md` naming Dialog as present.

**Where the ticket does not match the code:**

1. `src/lib/csv.test.ts:5-10` says NWP-101 "changes which columns ship, not how a cell is
   written, and these should still pass afterwards." Acceptance criterion 4 contradicts it:
   moving currency into its own column means the amount cell loses its `$`. Two tests
   (`writes only the requested columns` and `quotes cells containing a comma`) must change.
2. `.claude/rules/components.md` lists a `Dialog` primitive that does not exist. `Drawer` is
   the Radix dialog that is actually here.
3. `src/data/queries.ts:72-84` — `sortPayments` sorts amounts with `localeCompare` on the
   stringified minor units, so 9000 sorts after 25000. Pre-existing, out of scope, noted below.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` | Cents drift, and a formatted string re-enters arithmetic |
| "Validate on the server. Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` | Client-supplied column names reach a filename or a query |
| "One query builder. Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut." | `merchant-console/CLAUDE.md` | Export and table disagree about what "disputed" means |
| "The payments table is paginated. Building this in the browser exports the current page only, which is the bug we would be shipping instead of the feature." | `docs/tickets/NWP-101.md` | Ops gets 20 rows and does not notice |
| "Use what is here... Tailwind only. No inline `style` attributes, no CSS modules." | `.claude/rules/components.md` | A new dependency for a control that already exists |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Keyboard-only ops staff cannot export |
| "Storage and bucketing are UTC." | `merchant-console/CLAUDE.md` | The filename date shifts by a day near midnight |
| "Never edit seed data to make a failing case disappear." | `build-battle/CLAUDE.md` | Green tests, broken feature |

## Approach

Keep the export server-side and keep the single query builder. Add two new client params to
`GET /api/payments/export` — `columns` (comma-separated) and `scope` — and validate both in
`src/lib/csv.ts` against the existing `EXPORT_COLUMNS` allowlist before either reaches the
serializer or the filename. `scope=all` re-runs `filterPayments({ status: "all" })`, so "all
payments" is the same builder with empty filters rather than a second path. The Export button
becomes a client component that opens a Drawer (the Radix dialog already in
`src/components/Drawer.tsx`) holding native labeled checkboxes for columns and radios for
scope; the two row counts are computed on the server in `page.tsx` and passed in as props, so
the dialog fetches nothing. Download is an `<a>` whose href is rebuilt from state, disabled
when no column is selected, and the server independently returns 400 on an empty column list.
`amount` drops its symbol and formats via a new no-symbol helper added beside `formatMoney` in
`src/lib/money.ts`; `currency` stays its own column.

**Considered and rejected:** building the CSV in the browser from the rows already rendered.
It needs no API change and no validation round trip, and it is the exact bug the ticket names:
the table is paginated at `PAGE_SIZE = 20`, so the file would silently contain one page.

**Also rejected:** a new `/api/payments/count` endpoint for criterion 2. `page.tsx` already
holds the filtered `total` from `queryPayments`, and the all-payments total is one more call
to the same builder. An endpoint would add a fetch, a loading state, and an error state to buy
nothing, and `.claude/rules/components.md` says to keep data fetching out of components where
the server already has what you need.

**Also rejected:** adding `@radix-ui/react-checkbox`. Native `<input type="checkbox">` inside a
`<label>` is accessible without a dependency, and the rules say reach for what is here first.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/money.ts` | change | Add a symbol-free minor-units formatter beside `formatMoney`, so criterion 4 does not spawn a second formatter elsewhere |
| `src/lib/csv.ts` | change | Column metadata with labels and defaults; `parseExportColumns()` and `parseExportScope()` allowlists; `amount` cell loses its symbol; `exportFilename(scope, date)` |
| `src/lib/csv.test.ts` | change | Extend with column-serializer cases; correct the two tests that assert `$` in the amount cell |
| `src/app/api/payments/export/route.ts` | change | Read and validate `columns` and `scope`; branch scope through the same builder; 400 on empty columns |
| `src/app/payments/export-dialog.tsx` | add | Client component: the Drawer, column checkboxes, scope radios, live row count, disabled Download. Sits beside `filter-bar.tsx`, matching the neighborhood |
| `src/app/payments/page.tsx` | change | Compute both row counts server-side, replace the plain `<a>` with `<ExportDialog>` |

## Plan

1. **Symbol-free money formatter** — done when: `npm test` still passes and the new helper
   returns `250.00` for `25000` and `-1234567.89` for `-123456789`.
2. **Column metadata and allowlist parsing in `csv.ts`** — done when: `parseExportColumns("id,amount,../etc/passwd")`
   returns `["id","amount"]`, `parseExportColumns("")` returns `[]`, and `parseExportScope("nonsense")`
   returns `"filtered"`.
3. **Amount cell and `exportFilename(scope, date)`** — done when: `toCsv([p], ["amount","currency"])`
   is `250.00,USD` and `exportFilename("disputed", new Date("2026-08-13T23:00:00Z"))` is
   `payments-disputed-2026-08-13.csv`.
4. **Extend `src/lib/csv.test.ts`** — done when: `npm test` passes with the new serializer
   cases and the two corrected assertions.
5. **Route handler** — done when: `curl "/api/payments/export?columns=id,amount,currency&scope=all"`
   returns three columns over every payment, and `columns=` alone returns 400 with a message.
6. **Export dialog component** — done when: the Drawer opens from the Export button, last4 is
   unchecked on load, scope defaults to current filter, and Download is disabled with nothing ticked.
7. **Wire into `page.tsx`** — done when: both counts render in the dialog and the downloaded
   file matches the ticked columns and the chosen scope.
8. **`/ship-ready`, then commit** — done when: the skill reports clean and the branch has
   `NWP-101:`-prefixed commits.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| 1. Ops choose columns, last4 off by default | Unit test: default column set in `csv.test.ts` excludes `last4`. Browser: open the dialog, last4 checkbox is unticked, tick it, downloaded file gains the column |
| 2. Scope choice, row count visible before download | Browser: filter to Disputed, dialog shows the filtered count on "Current filter" and the full count on "All payments"; switching scope changes the count shown next to Download |
| 3. Filename reflects scope and date | Unit test on `exportFilename("disputed", …)` → `payments-disputed-2026-08-13.csv`. Browser: check the saved file's name |
| 4. Minor units internally, formatted once, currency in its own column | Unit test: `toCsv([p], ["amount","currency"])` is `250.00,USD`, and `escapeCell` never sees a `$`. Grep for a second formatter returns none |
| 5. Empty selection disables Download | Browser: untick everything, Download is `disabled` and not an active link. Server: `curl` with `columns=` returns 400, not an empty file |
| Full result set, not one page | `curl` the export with `scope=all` and count lines against the table's reported total, which exceeds `PAGE_SIZE = 20` |
| Server-side validation | Unit test: an unknown column name is dropped, not echoed into the header or the filename |

## Risks

- **Test file states the opposite of criterion 4.** `src/lib/csv.test.ts:5-10` claims the cell
  format does not change. Criterion 4 wins; the two affected assertions get corrected and the
  comment updated, and the escaping contract stays covered by moving the comma case to `description`.
- **Filename injection.** The scope segment must never be raw client input. It comes from the
  allowlisted `status` in `parseFilters()` or from a fixed literal, and is regex-sanitized in
  `exportFilename` as a second line of defense.
- **Counts go stale.** They render at page load and the store is in memory. Acceptable: the
  ticket asks for a count visible before download, not a live one.
- **`scope=all` on a large store.** The seed set is small and the store is in memory, so no
  streaming is needed. If the store grew this would need revisiting.

## Out of scope

- **The `sortPayments` amount bug** at `src/data/queries.ts:79-82`: amounts are compared with
  `localeCompare` on stringified minor units, so `9000` sorts after `25000`. Real, pre-existing,
  affects the table as much as the export. Noting it in the PR rather than fixing it here.
- Persistence — tracked as NWP-203.
- Column reordering, saved export presets, and scheduled exports. Nobody asked.
- A generic `Dialog` primitive in `src/components/`. `Drawer` covers this ticket; extracting one
  is a refactor with its own blast radius.

## Open questions

- Resolved before writing: the amount cell ships as plain `250.00` with no thousands grouping,
  so spreadsheets import it as a number, and the filename segment is `filtered` when scope is
  current-filter but no status filter is active.
- Should a merchant-scoped export name the merchant in the filename? Left out for now, since
  merchant names would need their own slug allowlist. Easy to add if ops asks.
