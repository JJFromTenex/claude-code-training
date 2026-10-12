# SPEC · NWP-101 — Payments export: choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Nazli Ucar
**Status:** reviewed

## Problem

Ops exports the payments table several times a day. The export always includes every column and only the current filter. Card last-four is in every file, so files bound for merchants are cleaned by hand: 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant. Dana's team needs to pick the columns and the scope before downloading.

## Current state

All paths are relative to `build-battle/merchant-console/`.

- `src/app/api/payments/export/route.ts:11-24`: `GET` runs `parseFilters` → `filterPayments` → `sortPayments` and returns `toCsv(rows)` with every column. It does not paginate, so the server side already exports the full filtered set. Filename comes from `exportFilename()` with no scope.
- `src/lib/csv.ts:13-24`: `EXPORT_COLUMNS` is the column allowlist. Its comment (`:8-10`) names NWP-101.
- `src/lib/csv.ts:58-67`: `toCsv(payments, columns)` already accepts a column subset and keeps the given order.
- `src/lib/csv.ts:51-54`: `amount` uses `formatMoney` and `currency` is its own column. Minor units are formatted once, on the way out, so that criterion is **already met**.
- `src/lib/csv.ts:69-71`: `exportFilename(date)` stamps the UTC date as `payments-YYYY-MM-DD.csv`.
- `src/lib/csv.test.ts`: tests for `toCsv` and `exportFilename`. The ticket says to extend this file.
- `src/data/queries.ts:18-36`: `parseFilters` checks `status`, `sort`, `direction` and `page` against allowlists. `merchantId` and `search` pass through unchecked. That's fine as long as neither reaches the filename.
- `src/app/api/payments/route.ts`: `GET /api/payments` returns `{ rows, total, page, pageCount }` through `queryPayments` (`queries.ts:102`). Its `total` is the row count, so no new count endpoint is needed.
- `src/app/payments/page.tsx:68-76`: Export is a plain `<a href="/api/payments/export?<query>">`. It's a server component, so the dialog has to be a new client component.
- `src/components/Drawer.tsx`: a Tremor drawer built on `@radix-ui/react-dialog`. It handles focus trapping, Escape and focus return. There's no checkbox primitive in `src/components/`.

**Where the ticket or docs don't match the code:**
- `.claude/rules/components.md` says `src/components/` has a `Dialog`. **It doesn't.** Only `Drawer.tsx` wraps Radix Dialog.
- The ticket warns against interpolating columns "into SQL". There's no SQL here. The equivalent risk is a client column name reaching `cell()` or the header row, so the defence is checking against `EXPORT_COLUMNS`.
- `src/data/queries.ts:79-81`: sorting by amount compares `String(a.amount)`, so `100000` sorts before `25000`. Any export with `sort=amount` comes out in the wrong order. This bug predates NWP-101. **Decision: fix it in this branch** (see Decisions).
- `src/app/payments/page.tsx:21-43`: the page builds its own filter object and its own `STATUSES` list instead of calling `parseFilters`. The table and the export agree today only because the export receives the same query string.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units… Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` | Cents drift, and amounts appear without a currency |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` | Unknown columns or path characters reach the CSV header or `content-disposition` |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug." | `merchant-console/CLAUDE.md` | The export and the table disagree on rows |
| "Building this in the browser exports the current page only." | NWP-101 notes | We'd ship a 20-row export as a feature |
| "Card last-four is **off** by default." | NWP-101 AC | The near-miss from last quarter happens again |
| "Return the same error shape everywhere… a body with a message safe to show a user." | `.claude/rules/api-routes.md` | The dialog can't explain a rejection |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name…" | `.claude/rules/components.md` | Fails accessibility and the tie-break |

## Approach

Keep the CSV generated on the server. Extend the existing export route with two allowlisted params:
- `columns`: a comma list checked against `EXPORT_COLUMNS`
- `scope`: `current` or `all`

`scope=all` ignores the filters and exports every payment through the same `filterPayments` and `sortPayments` path (empty filters). Column parsing, the default column set (everything except `last4`) and the scope-aware filename live in `src/lib/csv.ts` beside `EXPORT_COLUMNS`, and they're covered in `csv.test.ts`.

On `/payments`, the Export link becomes a client `ExportDialog` built on `Drawer`. It has:
- one labelled checkbox per column, with `last4` unchecked by default
- a scope radio, defaulting to current filter
- a row count taken from `GET /api/payments` `total`, fetched with the current query for "current filter" and with no filters for "all"
- a Download link that is disabled when no column is selected

**Considered and rejected:**
- *Building the CSV in the browser from the table rows.* It only exports the 20-row page, which is the bug the ticket warns about.
- *Adding a new `Dialog` primitive.* `Drawer` already gives us Radix Dialog accessibility, and a second wrapper means more code without new behaviour.
- *A separate `/api/payments/count` route.* `GET /api/payments` already returns `total`.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Add the default column set (all but `last4`), an allowlist parser for `columns`, and an `exportFilename` that takes a scope label and keeps today's output when no label is given |
| `src/lib/csv.test.ts` | Change | Tests for parsing (unknown, empty, duplicate, order), the default excluding `last4`, and filename labels |
| `src/app/api/payments/export/route.ts` | Change | Read `columns` and `scope`, return 400 `{ error }` for invalid or empty columns, pass the label into the filename |
| `src/app/payments/export-dialog.tsx` | Add | Client dialog: column checkboxes, scope radio, row count, disabled Download |
| `src/app/payments/page.tsx` | Change | Replace the `<a>` Export button with `ExportDialog`, passing the current query string |
| `src/data/queries.ts` | Change | `sortPayments` compares `amount` numerically, not as strings (`:79-81`), and the misleading comment is corrected |
| `src/data/queries.test.ts` | Add | Pins numeric amount order in both directions; no test exists beside `queries.ts` today |

## Plan

0. **Fix the amount sort, with a test.** Its own `NWP-101:` commit. Done when: `npm test` shows `2500 < 25000 < 100000` ascending and the reverse descending, and `/payments?sort=amount` orders correctly.
1. **Column parser and defaults in `csv.ts`, with tests.** Done when: `npm test` passes, unknown names are rejected, an empty list is rejected, duplicates collapse, any client order comes back in `EXPORT_COLUMNS` order, and the default omits `last4`.
2. **Scope-aware filename, with tests.** Done when: the `all`, `<status>`, `filtered` and no-label cases produce the names in the filename table below, and the existing `exportFilename` test still passes.
3. **Export route accepts `columns` and `scope`.** Done when: `curl -i "localhost:3000/api/payments/export?status=disputed&columns=id,amount,currency"` returns 3 columns and `payments-disputed-<today>.csv`; `columns=id,nope` returns 400 with a message; `scope=all` returns every payment.
4. **`ExportDialog` on `/payments`.** Done when: clicking Export opens a named dialog with `last4` unchecked, the row count matches the table footer (`page.tsx:142`) for the current filter, switching to All updates the count, and Download triggers the file.
5. **Empty-selection guard and keyboard pass.** Done when: unchecking every column disables Download, Tab and Escape work, and focus returns to Export on close.

**Filename rules:**

| Scope | Filters | Filename |
| --- | --- | --- |
| All | any | `payments-all-<date>.csv` |
| Current filter | a status | `payments-<status>-<date>.csv` |
| Current filter | merchant or search only | `payments-filtered-<date>.csv` |
| Current filter | none | `payments-all-<date>.csv` |

Only allowlisted words ever reach the filename.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last-four off by default | `csv.test.ts` default-set test, and opening the dialog shows `last4` unchecked |
| Choose scope; current is the default; row count before download | Dialog opens on "Current filter"; its count equals the `/payments` footer total; switching to All shows the store total |
| Filename reflects scope and date | `csv.test.ts` filename cases, and the `curl -i` `content-disposition` header from Plan step 3 |
| Minor units internally, formatted once, currency in its own column | Already true (`csv.ts:51-54`). The existing `toCsv` tests still pass, and no new formatting is added |
| No columns selected disables Download | Click-through in step 5. The server also returns 400 on empty `columns`, so a hand-built URL can't produce an empty file |
| Amount sort (added) | `src/data/queries.test.ts`, and an export with `sort=amount` is in numeric order |
| DoD: serializer unit test, `npm test` passes | `npm test` from `build-battle/merchant-console/` |

## Risks

- **Rows and count drift.** The count comes from `/api/payments` and the rows from `/api/payments/export`. Both use `parseFilters` and `filterPayments`, so they agree as long as both receive the same query string. The dialog builds both URLs from one source.
- **Formatted amounts in spreadsheets.** `formatMoney` writes `"$1,234,567.89"` (quoted), which Excel reads as text. The existing tests pin this, so it stays as is. See Open questions.
- Test baseline before step 1: `npm test` passed 28/28 (Node 24.21, npm 11.19).
- `Drawer.tsx` uses `animate-dialogOverlayShow`, which has no keyframe in `tailwind.config.ts`. It's harmless (no animation) and not touched here.

## Out of scope

- Fixing the page's duplicate filter parsing (`page.tsx:21-43`). Noted, not touched.
- Saved column presets, XLSX, and scheduled exports.
- Persisting anything (NWP-203) and the totals bug (NWP-102).

## Decisions

Resolved with the engineer on review:

- **Amount sort:** fixed in this branch, as a separate `NWP-101:` commit with a test (Plan step 0).
- **Amount column:** keeps the currency symbol (`$250.00`). The `currency` column stays as well. The `csv.test.ts` assertions are unchanged.
- **Column order:** always canonical `EXPORT_COLUMNS` order, whatever order the client sends.

## Open questions

- None blocking. The duplicate filter parsing in `page.tsx:21-43` is a candidate for a follow-up ticket.
