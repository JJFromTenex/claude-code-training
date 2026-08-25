# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Avi Raju
**Status:** draft

## Problem

Dana's ops team exports the payments table several times a day — merchant queries, month-end
reconciliation, whatever Finance asks for — and every file comes out identical: every column,
current filter only. The card last-four is in all of them, so any file going to a merchant is
hand-edited first. That is 3–4 hours a month of spreadsheet cleanup, and last quarter an
unedited file nearly went to the wrong merchant.

## Current state

- `src/app/api/payments/export/route.ts:11` — the export route. Calls `parseFilters()`, then
  `filterPayments` + `sortPayments` (deliberately skipping `paginate`, so the file already
  covers the whole filtered set, not the visible page). Column set and scope are hard-coded;
  its own comment names NWP-101 as the fix.
- `src/lib/csv.ts:13` — `EXPORT_COLUMNS`, the ten-column canonical list, with `last4` at
  position 8. `toCsv()` (`src/lib/csv.ts:58`) **already accepts a `columns` argument** and
  writes only those, in the order given. `cell()` (`src/lib/csv.ts:33`) is a total switch over
  `ExportColumn`, so a new column is a compile error until it is handled.
- `src/lib/csv.ts:69` — `exportFilename(date)` returns `payments-YYYY-MM-DD.csv`. No scope
  segment. The date is injectable, which is how the existing test pins it.
- `src/lib/csv.test.ts:1` — eight cases covering escaping, the merchant fallback, and the
  column contract. Its header comment says NWP-101 "changes which columns ship, not how a cell
  is written, and these should still pass afterwards." Treat that as a constraint.
- `src/data/queries.ts:18` — `parseFilters()`, the allowlist boundary. Route handlers pass it
  raw `URLSearchParams` and never read params themselves. It allowlists status, sort and
  direction; it knows nothing about columns or scope.
- `src/app/payments/page.tsx:68` — the Export button today: a `<Button asChild>` wrapping a
  plain `<a href="/api/payments/export?…">` with the page's current query string. The page
  already has `total` for the current filter in hand at `src/app/payments/page.tsx:45`.
- `src/lib/money.ts:15` — `formatMoney(minorUnits, currency)`. `cell()` already calls it for
  the `amount` column and emits `currency` as its own column, so **AC 4 holds today**; the
  work is not regressing it.

**Where the ticket does not match the code:**

- "Do not interpolate them into SQL" — there is no SQL. The store is an in-memory object
  generated at boot (`src/data/store.ts`, `src/data/generate.ts`). The rule behind the note
  still binds: allowlist client column names server-side before they reach `cell()` or a
  filename.
- `.claude/rules/components.md` says `src/components/` "already has … Dialog". It does not.
  There is `Drawer.tsx` (built on `@radix-ui/react-dialog`) and `DropdownMenu.tsx`, no Dialog
  and no Checkbox. `@radix-ui/react-dialog@^1.1.15` **is** already a dependency.
- Pre-existing, not ours to fix: `sortPayments` sorts amounts with
  `String(a.amount).localeCompare(...)` (`src/data/queries.ts:81`), which orders `9000` above
  `10000`. The export inherits that row order. Noted under Risks.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`… Format at the edge" | `.claude/rules/money.md` | Cents drift; a re-parsed `"$1,234.56"` becomes a float |
| "Every amount travels with its currency code" | `.claude/rules/money.md` | A mixed-currency export sums to a meaningless number in Excel |
| "Validate everything from the client against an allowlist before it reaches the store, a query, or a filename. Column names, currencies, statuses…" | `.claude/rules/api-routes.md` | An arbitrary column name reaches `cell()` or the `content-disposition` header |
| "Reuse the query builder… Writing a second filter path is a defect" | `.claude/rules/api-routes.md` | Export and table disagree about what "disputed" means |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user" | `.claude/rules/api-routes.md` | Empty-column request 500s or returns a header-only file |
| "Dialogs and forms must be operable… every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it" | `.claude/rules/components.md` | Keyboard-only ops staff cannot run an export |
| "Storage and bucketing are UTC" | `merchant-console/CLAUDE.md` | Filename date flips a day for a London export at 23:00 |
| Card last-four is off by default | Ticket AC 1 | The exact failure the ticket was filed about |

## Approach

Push the whole feature server-side and keep one query path. Add an export-options parser to
`src/lib/csv.ts` that allowlists client-supplied columns against `EXPORT_COLUMNS` and scope
against `filtered | all`, returning columns re-ordered into canonical `EXPORT_COLUMNS` order
(so duplicates, unknowns and client ordering collapse into one deterministic result) and
`null` when nothing valid survives. The export route calls it, answers an empty selection with
`400` and a user-safe message, and chooses its filter object by scope — `parseFilters(params)`
for `filtered`, an unfiltered object carrying only sort and direction for `all`. Both still go
through `filterPayments` + `sortPayments`; no second filter path. `exportFilename` grows a
scope segment. On the page, the Export button opens a dialog whose checkboxes default to every
column except `last4`; row counts for both scopes are computed on the server in `page.tsx` via
`queryPayments()` and passed down as props, so the dialog fetches nothing and Download stays an
`<a href>` to the same route.

**Considered and rejected:** building the column picker in the browser and slicing the rows the
page already has. It is less code and it is the bug the ticket warns about — the table is
paginated at 20 (`src/data/queries.ts:43`), so the file would silently contain one page. Also
rejected: teaching `parseFilters()` about columns and scope. Those are export concerns, not
filter concerns, and every other caller of `parseFilters` would pay for them; keeping the
parser next to `toCsv` in `src/lib/csv.ts` is also what makes it unit-testable in the file the
Definition of Done names.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `DEFAULT_EXPORT_COLUMNS` (all but `last4`), `parseExportOptions()` allowlist, scope segment in `exportFilename()` |
| `src/lib/csv.test.ts` | change | Extend — the DoD says extend this file, not start a new one |
| `src/app/api/payments/export/route.ts` | change | Parse options, 400 on empty selection, pick filters by scope, pass columns to `toCsv` |
| `src/components/Dialog.tsx` | add | No Dialog exists despite the rules file; build on `@radix-ui/react-dialog`, already a dependency, following the Tremor pattern in `Drawer.tsx` |
| `src/app/payments/export-dialog.tsx` | add | Client component: checkboxes, scope radios, live row count, disabled Download |
| `src/app/payments/page.tsx` | change | Render the dialog in place of the bare anchor; pass query, filtered total, and all-payments total |

No new dependencies. Checkboxes and radios are native inputs with labels and Tailwind classes —
`@radix-ui/react-checkbox` is not installed and `components.md` says use what is here.

## Plan

1. **Column and scope allowlist in `src/lib/csv.ts`** — done when: `parseExportOptions` returns
   canonical-ordered columns for a valid list, drops unknown names, and returns `null` columns
   for an empty or all-garbage list; `npx vitest run src/lib/csv.test.ts` is green.
2. **Scope-aware `exportFilename`** — done when: `exportFilename(date, "disputed")` is
   `payments-disputed-2026-08-13.csv`, `"all"` gives `payments-all-…`, and no descriptor gives
   the current `payments-….csv`. Existing filename test still passes untouched.
3. **Route handler** — done when: `curl -i '/api/payments/export?columns=id,amount&status=disputed'`
   returns two columns and a `payments-disputed-*.csv` filename; `&scope=all` ignores the status
   filter and returns every row; `&columns=` returns `400` with a readable message; a bogus
   column name is dropped rather than echoed.
4. **`Dialog.tsx`** — done when: it opens from the Export button, has an accessible name,
   traps and restores focus, and closes on Escape.
5. **`export-dialog.tsx` + `page.tsx` wiring** — done when: `last4` is unchecked on open, both
   scopes show their row count, unchecking every column disables Download, and downloading
   produces a file matching the selection.
6. **Full suite** — done when: `npm test` and `npm run build` both pass from
   `build-battle/merchant-console/`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns are selectable; `last4` off by default | Unit: `DEFAULT_EXPORT_COLUMNS` excludes `last4`. Manual: open the dialog, `last4` unchecked, download, no last-four column in the file |
| Scope selectable, filtered default, count visible first | Manual on `/payments?status=disputed`: both radios show counts, filtered is preselected, and the counts match the "N payments" line at `src/app/payments/page.tsx:142` |
| Filename reflects scope and date | Unit: `exportFilename` cases for status, `all`, and no descriptor. Manual: check `content-disposition` |
| Minor units internally, formatted once, currency its own column | Unit: existing `toCsv([payment], ["id","amount"])` → `pay_0001,$250.00` still passes; no new formatter is added and `formatMoney` stays the only caller |
| Empty selection disables Download | Manual: uncheck all → button disabled. Route: `columns=` → `400`, not an empty file |
| Server-side validation | Unit: unknown column name is dropped by `parseExportOptions`. `curl` with `columns=id,../../etc/passwd` returns only `id` |

`npm test` output goes in the PR verbatim. Note that vitest here is node-only and collects
`src/**/*.test.ts` only (`vitest.config.ts`) — a `.test.tsx` is silently never run, so the
dialog is verified in the browser, not by a component test, and the PR will say so.

## Risks

- **`last4` re-enters by accident.** The default list is defined once in `src/lib/csv.ts` and
  imported by the client, so the checkbox state and the server default cannot drift apart.
- **Amount sort order is already wrong** (`src/data/queries.ts:81`, lexicographic on a number).
  The export inherits it. Not in this ticket; flagged for a follow-up rather than fixed here,
  since changing it changes the table too.
- **Big "all payments" export.** No streaming — the whole CSV is built in memory. Acceptable at
  the generator's row count; worth revisiting if the store ever grows.
- **A second allowlist.** `src/app/payments/page.tsx:36` already re-implements status parsing
  instead of calling `parseFilters`. I am not adding a third; the dialog passes the page's query
  string through untouched and lets the route parse it.

## Out of scope

- Persisting a preferred column set per user — no persistence layer, and NWP-203 owns that.
- Export formats other than CSV, and scheduled or emailed exports.
- Fixing the amount sort (see Risks) or the duplicated status allowlist in `page.tsx`.
- Anything in NWP-102.

## Open questions

- The filename date is the real download date (`new Date()`), while the app's "now" is
  `GENERATED_AT` = `2026-08-13`. Keeping the real date matches today's behavior and its test,
  so the AC's example only reproduces exactly if you export on 2026-08-13. Assuming that is
  fine; say so if ops expects the data date instead.
- Does Finance want a `merchant_id` column that does not exist in `EXPORT_COLUMNS` today? Not
  adding one unless asked — `cell()`'s exhaustive switch makes it a two-line change later.
