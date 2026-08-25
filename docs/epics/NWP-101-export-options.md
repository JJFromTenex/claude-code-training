# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Vyoma Gajjar
**Status:** draft

## Problem

Ops exports the payments table several times a day for merchant queries, month-end
reconciliation, and Finance requests. The file is fixed: every column, current filter only.
The card last four is in every export, so anything going to a merchant is cleaned up by hand
first. Dana Whitfield's team spends 3 to 4 hours a month on that editing, and last quarter an
unedited file nearly went to the wrong merchant.

## Current state

The export already works and already reuses the query builder. What is missing is choice.

- `src/app/payments/page.tsx:46` — the Server Component copies the current `searchParams`,
  drops empty values, and at `:69` renders the Export button as a plain `<a>` to
  `/api/payments/export?{query}`. No client JavaScript is involved in the download.
- `src/app/api/payments/export/route.ts:11` — the handler parses, filters, sorts, serializes,
  and answers. It holds no filtering logic of its own.
- `src/data/queries.ts:18` — `parseFilters()` is the existing server-side allowlist: status
  against a fixed list, `sort` to `amount` or `createdAt`, `direction` to `asc` or `desc`.
  It knows nothing about columns or scope yet.
- `src/data/queries.ts:45` — `filterPayments()` is the one query builder. The export calls it
  and `sortPayments()` directly rather than `queryPayments()`, which is the paginating wrapper
  the table uses. **The export is already the whole filtered set, not the current page.**
- `src/lib/csv.ts:13` — `EXPORT_COLUMNS` is already a ten-entry allowlist and already exports
  `ExportColumn`. `toCsv()` at `:58` already accepts a `columns` argument and defaults to all
  of them; `csv.test.ts:32` pins that it writes only the requested columns, in the order given.
- `src/lib/csv.ts:69` — `exportFilename()` takes a date only and returns `payments-YYYY-MM-DD.csv`.

**Where the ticket does not match the code:**

- AC4 reads like a change, but it is already true. `cell()` at `csv.ts:52` calls `formatMoney()`
  at the serialization edge, amounts stay integer minor units everywhere upstream, and
  `currency` is already its own column at `csv.ts:23`. `csv.test.ts` pins `$250.00` and its
  header comment says NWP-101 changes which columns ship, not how a cell is written. Treat AC4
  as a regression to avoid, not a change to make.
- `.claude/rules/components.md` says `src/components/` already has a Dialog. It does not. There
  is `Drawer.tsx` built on `@radix-ui/react-dialog`, and no Checkbox. `@radix-ui/react-checkbox`
  is not a dependency.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units... Format once, at the edge, next to its currency code" | `merchant-console/CLAUDE.md` | Cents drift, and AC4 regresses |
| "Anything from the client... is checked against an allowlist before it reaches a query, a filename, or the store" | `.claude/rules/api-routes.md` | Column names reach a filename or a query unchecked |
| "Client-side checks are a convenience, never the enforcement" | `.claude/rules/api-routes.md` | A hand-edited URL bypasses the dialog entirely |
| "One query builder... A second implementation is a bug, not a shortcut" | `merchant-console/CLAUDE.md` | Two filter paths disagree, silently |
| "Building this in the browser exports the current page only" | ticket, Notes from the team | Ships a 20-row file as if it were the feature |
| "Return the same error shape everywhere" | `.claude/rules/api-routes.md` | Empty-column requests fail inconsistently |

## Approach

Keep the download a plain link and keep every decision server-side. `src/lib/csv.ts` grows two
pure functions: one that takes the client's requested column names and returns a validated
subset of `EXPORT_COLUMNS` in canonical order, and a widened `exportFilename()` that takes a
scope token alongside the date. The export route reads `scope` and `columns` from the query
string, resolves scope to either the parsed filters or empty filters, and runs both through the
same `filterPayments()` and `sortPayments()` it uses today. A new client island renders the
options dialog and does nothing more than compose that query string; the counts it displays are
passed down from the Server Component, which already computes the filtered total at
`page.tsx:45`.

**Considered and rejected:** fetching rows into the dialog and building the CSV in the browser.
It gives a live row count for free, but the table is paginated, so it exports 20 rows and calls
it a feature. That is the exact failure the ticket names. Rejected outright.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Column allowlist parser; `exportFilename()` gains a scope token |
| `src/lib/csv.test.ts` | change | Extend per the DoD; do not start a new test file |
| `src/app/api/payments/export/route.ts` | change | Read and validate `scope` and `columns`; keep reusing the builder |
| `src/components/Dialog.tsx` | add | Tremor dialog on the already-installed `@radix-ui/react-dialog`; closes the gap `components.md` assumes |
| `src/app/payments/export-dialog.tsx` | add | Client island: column checkboxes, scope choice, row count, Download |
| `src/app/payments/page.tsx` | change | Compute both row counts, render the dialog in place of the bare link |

## Plan

1. **Column parser and scoped filename in `src/lib/csv.ts`, tests in `csv.test.ts`** — done when:
   `npm test` passes, unknown column names are dropped, an empty selection is distinguishable
   from a default one, last four is absent from the default set, and every existing case in
   `csv.test.ts` still passes untouched.
2. **Export route reads `scope` and `columns`** — done when: requesting two columns returns a
   two-column file, `scope=all` returns more rows than the same request under a status filter,
   an injected column name is ignored rather than echoed, and an empty column set returns a
   400 in the shared error shape.
3. **`src/components/Dialog.tsx`** — done when: it opens and closes, has an accessible name,
   Escape closes it, and focus moves in and returns to the Export button on close.
4. **`export-dialog.tsx` wired into `page.tsx`** — done when: both row counts render before
   download, last four starts unchecked, Download is disabled at zero columns, and the link it
   builds carries the current filters.
5. **Full pass** — done when: `npm test` and `npm run lint` are clean and both scopes have been
   downloaded and opened.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns selectable, last four off by default | New unit cases in `src/lib/csv.test.ts` for the parser's default and its allowlist behavior; then open the dialog and confirm the checkbox is clear |
| Scope choice, current filter default, row count visible | Download `/payments?status=disputed` under each scope and compare line counts against the count shown in the dialog |
| Filename reflects scope and date | Unit case on `exportFilename()`; then download under a status filter and read the saved name |
| Minor units internally, formatted once, currency in its own column | The existing `csv.test.ts` cases pass unchanged; `cell()` is not edited |
| Empty selection disables Download | Uncheck every column and confirm the button is disabled; separately, hand-edit the URL to an empty `columns` and confirm the route returns 400 rather than a header-only file |

## Risks

- **The dialog is not unit-testable here.** `vitest.config.ts` runs the node environment and
  collects only `src/**/*.test.ts`, so no `.tsx` and no DOM. Everything worth pinning has to
  live in the pure functions in `src/lib/csv.ts`; the dialog is verified by hand.
- **Two allowlists could drift.** The dialog's checkbox list and `EXPORT_COLUMNS` must be one
  source of truth, with the dialog rendering from the exported constant.
- **Pre-existing, not fixed here:** `sortPayments()` at `queries.ts:81` compares amounts as
  strings, so `sort=amount` orders lexicographically. It predates this ticket and affects row
  order in the export. Flagging it rather than widening scope.

## Out of scope

- Persistence of any kind. The store is in memory and that is NWP-203.
- Saved or remembered column presets. Not asked for.
- Fixing the amount sort above, and anything in NWP-102.

## Open questions

Both resolved during implementation:

- **Does "all payments" ignore a date range too?** Yes. `scope=all` runs `filterPayments({})`,
  discarding every filter, and the dialog now strips the filter params from the URL rather than
  sending ones the server will drop.
- **Column order in the file.** Split, deliberately. The dialog always emits canonical
  `EXPORT_COLUMNS` order, so two people ticking the same boxes get identical files. The server
  honors the order it is given, so a hand-built `?columns=amount,id` gets `amount,id`. Order is
  not a safety property, and honoring it keeps the contract `csv.test.ts` already pinned.

## Decisions changed during implementation

Recorded because they contradict the plan above, not because the plan was wrong to write.

- **Reused `Drawer` instead of adding `src/components/Dialog.tsx`** (file map, step 3). Reading
  `src/components/Drawer.tsx` in full showed it is already a complete accessible Radix dialog;
  a new `Dialog.tsx` would have been ~150 near-duplicate lines plus new Tailwind keyframes.
  Trade-off: the panel slides in from the right rather than sitting centered.
- **`page.tsx` now calls `parseFilters`** rather than hand-rolling its filter object. Review
  found the two parses could disagree: `/payments?status=captured&from=2026-08-01` showed 1,299
  in the dialog while the file held 132 rows, because the page ignored `from`/`to` and the route
  honored them. One allowlist for both is the fix, and it makes AC2's count trustworthy.
- **`exportScopeLabel` names a status only when the status is the sole narrowing filter.** The
  first implementation returned the status and stopped, so `status=disputed&merchantId=mch_01`
  produced `payments-disputed-….csv` holding 5 of 33 disputed payments. A name that overstates
  its contents is the near-miss this ticket exists to prevent.
- **Added `src/app/api/payments/export/route.test.ts`.** The plan put all coverage in
  `csv.test.ts`, but the route is a plain function of a `NextRequest` and runs in the existing
  node environment, so the 400 path and the `scope=all` branch are now tested rather than
  hand-checked.
