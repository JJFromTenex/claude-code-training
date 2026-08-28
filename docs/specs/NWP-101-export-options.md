# SPEC · NWP-101 — Payments export: let ops choose columns and scope

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Santiago
**Status:** draft

## Problem

Ops exports the payments table several times a day and gets the same fixed file every time: every column, current filter only. The card last-four is always in it, so anything going to a merchant is cleaned up by hand first — Dana's team estimates 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant. They want to pick the columns and the scope before the file is written, not after.

## Current state

- `src/app/payments/page.tsx` — Server Component. Builds `PaymentFilters` from `searchParams`, calls `queryPayments()`, and renders 20 rows. The Export button is a bare `<a href="/api/payments/export?{query}">`; the same query string, forwarded verbatim.
- `src/app/api/payments/export/route.ts` — calls `parseFilters()`, then `filterPayments()` + `sortPayments()`, deliberately **not** `paginate()`. So the "current filter" scope already works and already covers every matching row, not the visible page.
- `src/data/queries.ts` — the one query builder. `parseFilters()` is the allowlist choke point; it validates `status`, `sort`, `direction`, `page` and ignores anything else. It knows nothing about columns or scope today.
- `src/lib/csv.ts` — `toCsv(payments, columns = EXPORT_COLUMNS)` **already accepts a column subset and honours the given order**. `EXPORT_COLUMNS` is the ten-name allowlist. The route passes no columns, which is the whole bug.
- `src/lib/csv.ts` — `exportFilename(date = new Date())` returns `payments-YYYY-MM-DD.csv`. No notion of scope.
- `src/lib/csv.test.ts` — nine passing tests pinning escaping, column subsetting, and the filename. Its header comment says NWP-101 changes which columns ship, not how a cell is written.
- `src/components/Drawer.tsx` — the only Radix-dialog component in the repo (`Drawer`, `DrawerContent`, `DrawerTitle`, `DrawerFooter`, `DrawerClose`). There is no separate `Dialog.tsx`, despite what `.claude/rules/components.md` implies.

Two things in the ticket that turn out **not** to match the code:

- *"Amounts stay in minor units internally and are formatted once on the way out, with currency in its own column."* Already true: amounts are `number` minor units end to end, `cell()` calls `formatMoney()` once at serialization, and `currency` is already its own column. No change needed — and changing how the `amount` cell is written would break two pinned tests.
- *"Do not interpolate them into SQL."* There is no SQL. The store is an in-memory array (`src/data/store.ts`). The equivalent risk is an unvalidated column name reaching `toCsv()` or the `content-disposition` filename, which is what the allowlist guards.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Validate everything from the client against an allowlist | `.claude/rules/api-routes.md` | A column name from a query string reaches a filename header |
| Reuse the one query builder | `merchant-console/CLAUDE.md` | A second filter path drifts from the table it is meant to mirror |
| Money is integer minor units, formatted once at the edge | `.claude/rules/money.md` | Cents drift; the existing csv tests fail |
| Storage and bucketing are UTC | `merchant-console/CLAUDE.md` | The filename date disagrees with the rows in the file |
| Dialogs must be operable: accessible name, labelled inputs, Escape closes | `.claude/rules/components.md` | Keyboard-only ops staff cannot export |
| Keep data fetching out of components where the server already has it | `.claude/rules/components.md` | A loading spinner for a number the page already knows |

## Approach

Push both new choices through the existing choke points rather than adding new ones. `parseFilters()` gains `columns` and `scope`, validated the same way `status` already is: `columns` is split, filtered against `EXPORT_COLUMNS`, deduped, order preserved, and empty means "use the default set minus `last4`"; `scope` is `filter` (default) or `all`. The export route asks the query builder for rows — with the parsed filters, or with empty filters when scope is `all` — and hands the validated column list to `toCsv()`. On the client, the Export button becomes a Drawer holding checkboxes and a scope radio; both row counts are computed server-side in `page.tsx` and passed in as props, so the dialog shows the count with no fetch and no loading state. Download stays a plain link to the export route, so the file is always built from the full result set.

**Considered and rejected:** building the CSV in the browser from the rows already on screen. It removes the round trip and is the bug the ticket names — the table is paginated at 20, so the file would silently cover one page. Also rejected: a second `/api/payments/export/count` route for the row counts; the Server Component already has the store in process, so the call is free.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/queries.ts` | change | `parseFilters()` validates `columns` and `scope`; `PaymentFilters` gains both |
| `src/data/types.ts` | change | `columns` and `scope` on `PaymentFilters` |
| `src/lib/csv.ts` | change | `exportFilename(date, label?)` — optional scope label, existing call sites unchanged |
| `src/lib/csv.test.ts` | change | New cases for column selection and the scoped filename |
| `src/app/api/payments/export/route.ts` | change | Honour scope, pass validated columns, reject an empty selection |
| `src/app/payments/export-dialog.tsx` | add | Client component: column checkboxes, scope radio, row count, Download link |
| `src/app/payments/page.tsx` | change | Compute both counts, render the dialog in place of the bare link |

## Plan

1. **Validation in the query layer** — `parseFilters()` accepts `columns` and `scope`. Done when: `?columns=id,amount,nonsense&scope=all` yields exactly `["id","amount"]` and `scope: "all"`, and `?columns=nonsense` yields an empty list.
2. **Export route honours both** — scope `all` queries with empty filters; validated columns reach `toCsv()`; an explicitly empty valid selection returns `400` with a message safe to show a user. Done when: `curl` on the four combinations returns the right header row and row count.
3. **Filename carries the scope** — `exportFilename(date, label?)` produces `payments-disputed-2026-08-13.csv` and `payments-all-….csv`, and still produces `payments-….csv` with no label. Done when: the existing filename test passes untouched and the new one passes.
4. **Tests for the serializer** — extend `src/lib/csv.test.ts`: a subset in the requested order, `last4` absent from the default selection, and an empty selection. Done when: `npm test` is green and the count has grown from 9.
5. **The dialog** — Drawer with a labelled checkbox per column (`last4` unchecked), a scope radio defaulting to current filter, the matching row count, and a Download link that is disabled with zero columns checked. Done when: keyboard-only operation works, Escape closes, and the downloaded file matches the choices.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops chooses columns; last-four off by default | Unit test on `toCsv` default selection; open the dialog and confirm `last4` is unchecked |
| Scope current-filter or all, current default, count visible | Filter to `disputed`, open the dialog, compare both counts against the table footer |
| Filename reflects scope and date | Unit test on `exportFilename`; check `content-disposition` on a live request |
| Amounts in minor units, formatted once, currency its own column | Existing `csv.test.ts` cases stay green unmodified |
| Empty selection disables Download | Dialog: uncheck everything, Download is disabled; route returns `400` if called directly |

## Risks

- **Signature change to `exportFilename` breaks the pinned test.** Keep `date` as the first parameter and add the label second, so the existing call `exportFilename(new Date(...))` is untouched.
- **Column order is user input.** Preserving the requested order is a feature, but duplicates must be dropped or the header repeats — dedupe during validation.
- **Scope `all` ignores the URL filters, which is surprising when the dialog is opened from a filtered table.** Mitigated by showing both counts side by side rather than one number.

## Out of scope

- Persisting a column preference between sessions. No store to put it in; persistence is NWP-203.
- Changing how any cell is written, including the `$` in the `amount` column.
- Export for disputes or payouts. This ticket is the payments table only.

## Open questions

- With scope `all`, does the filename want the date range or just `all`? Assuming `payments-all-YYYY-MM-DD.csv` until Dana says otherwise.
- Should the scope label follow `merchantId` as well as `status`? The ticket's example only shows a status.
