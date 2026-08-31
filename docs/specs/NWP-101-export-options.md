# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** kennanmurphy
**Status:** building

## Problem

Ops exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for. The export works, but it is fixed: every column, current filter only, no say in what comes out. The card last-four lands in every file, so anything going to a merchant gets cleaned up by hand first. Dana's team puts that at 3–4 hours a month, plus a near-miss last quarter where an unedited file nearly went to the wrong merchant.

## Current state

The flow is already the right shape — server-side, and it already reuses the one query builder. It is only missing control.

- `src/app/payments/page.tsx:68-76` — Export is a plain `<a href="/api/payments/export?…">` forwarding the page's query string. Not a fetch, so the browser does the download.
- `src/app/api/payments/export/route.ts` — `GET` hands params to `parseFilters()`, the same allowlist parser `/api/payments` uses, then calls `filterPayments()` + `sortPayments()`.
- `src/data/queries.ts` — the one query builder. The export deliberately skips `paginate()`, so it already returns every matching row rather than the visible page.
- `src/lib/csv.ts` — `toCsv()` serializes rows, formatting money once via `formatMoney()` and quoting cells containing a comma, quote, or newline. `exportFilename()` stamps the UTC date.
- **Does not match the ticket:** `toCsv(payments, columns)` *already* accepts a column subset and honors its order, and `src/lib/csv.test.ts:32` already tests that. The serializer needs no new capability — what is missing is a way for a client to select columns, server-side validation of that selection, a scope concept, and a filename that reflects it.
- **No `Checkbox.tsx` and no `Dialog.tsx` exist.** `src/components/Drawer.tsx` is the available Radix-dialog-based modal, with focus trap, Escape handling, and an accessible title.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `merchant-console/CLAUDE.md` | Cents drift on every total |
| Storage and bucketing are UTC | `merchant-console/CLAUDE.md` | Exports disagree with the table across a date boundary |
| One query builder behind `GET /api/payments` | `.claude/rules/api-routes.md` | A second filter path diverges from the list view |
| Client input is allowlisted before reaching a query, a filename, or the store | `.claude/rules/api-routes.md` | Arbitrary column names reach the serializer and the filename |
| Dialogs and forms must be operable; every input has a label | `.claude/rules/components.md` | The dialog is unusable by keyboard and screen reader |

## Approach

Put column validation in `src/lib/csv.ts` next to the serializer it guards, so it is unit-testable without a request. The route parses and allowlists the `columns` param, rejects an unknown or empty selection with a 400, resolves scope, and reuses `filterPayments()` for both scopes — passing `{ status: "all" }` for the all-payments case rather than adding a second filter path. The dialog is a client component that builds a URL and hands it to an `<a>`, exactly as the Export button does today.

**Considered and rejected:** building the CSV in the browser from the rows already on the page. It removes a round trip and is tempting because the data is right there — but the table is paginated, so it would silently export only the visible 20 rows. That is the bug the ticket explicitly warns about shipping instead of the feature. Also rejected: `fetch` + Blob download, which adds client state and a loading path for no gain over a plain link.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns()`, `exportScopeLabel()`, scoped `exportFilename()` |
| `src/app/api/payments/export/route.ts` | change | Validate columns, resolve scope, 400 on bad input |
| `src/app/payments/export-dialog.tsx` | add | The options dialog, client component |
| `src/app/payments/page.tsx` | change | Compute both row counts server-side, render the dialog |
| `src/lib/csv.test.ts` | change | Cover the new selection and filename surface |

## Plan

1. **Column selection and validation in `csv.ts`** — done when: `parseExportColumns` returns the defaults for an absent param, rejects empty and unknown names, and preserves requested order.
2. **Scoped filename in `csv.ts`** — done when: `exportFilename("disputed", d)` is `payments-disputed-2026-08-13.csv`.
3. **Route handler** — done when: `columns=bogus` and `columns=` return 400s with readable messages, and a valid subset downloads with those columns.
4. **Dialog component** — done when: last-four starts unchecked, counts show for both scopes, and Download is disabled at zero columns.
5. **Tests** — done when: `npm test` passes with the new cases and the existing escaping tests untouched.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Unit test on `DEFAULT_EXPORT_COLUMNS`; dialog shows last-four unchecked on open |
| Scope current-filter or all, count visible, filter default | Both counts computed in `page.tsx` and rendered per scope; filter is the initial state |
| Filename reflects scope and date | Unit tests on `exportScopeLabel` + `exportFilename`; download filtered to Disputed |
| Amounts stay minor units, formatted once, currency its own column | Unchanged `formatMoney()` call in `cell()`; existing `toCsv` tests still pass |
| Empty selection disables Download | Dialog renders a disabled Button rather than a link; route returns 400 as the server-side backstop |

## Risks

- Changing `exportFilename()`'s signature breaks the existing test at `src/lib/csv.test.ts:80`. That test pins the old contract the ticket deliberately changes, so it gets **updated, not deleted** — its UTC-date assertion is preserved and only the scope segment is added. Flagged so it is not mistaken for weakening a test to make a build pass.
- `page.tsx` parses filters by hand rather than through `parseFilters()`, so the page's notion of the active filter and the route's can drift. Out of scope to fix here; the export link forwards the raw query string, so both sides see the same params.

## Out of scope

- Persisting a preferred column set per user — no store for it, and persistence is NWP-203.
- Export formats other than CSV.
- Fixing the divergent filter parsing in `page.tsx`.

## Open questions

- None blocking. The filename rule for a filtered-but-statusless export was resolved to `filtered`.
