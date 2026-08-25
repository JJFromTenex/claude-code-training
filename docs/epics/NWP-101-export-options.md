# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Alexander Ramirez
**Status:** draft

## Problem

Dana's ops team exports payments several times a day, and every export is identical: every column, current page's filter only, no choice. Card last-four rides along in every file, so any export headed to a merchant needs manual scrubbing first, roughly 3-4 hours a month, and there was a near-miss last quarter where an unscrubbed file almost went out. Ops needs to pick what leaves the building and how much of it.

## Current state

- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?...">`, forwarding the current filter querystring verbatim. No dialog, no options.
- `src/app/api/payments/export/route.ts` — fixed column set, fixed scope. It already reuses `parseFilters` and `filterPayments`/`sortPayments` from the one query builder, which is the right pattern to keep.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` (10 columns, `last4` included), `toCsv(payments, columns?)` already accepts a column subset and preserves order, and `cell()` already formats money via `formatMoney` at the edge. `exportFilename(date?)` only stamps the date: `payments-2026-03-14.csv`, no scope.
- `src/lib/csv.test.ts` — pins escaping and the column contract; the ticket's own DoD says extend this file, not replace it.
- `src/data/queries.ts` — `parseFilters`, `filterPayments`, `sortPayments`, `queryPayments` (filter+sort+paginate) is the one query builder. `filterPayments({})` (no filters) returns every payment, which is exactly "all payments" scope.
- `GET /api/payments` (`src/app/api/payments/route.ts`) already returns `{ rows, total, page, pageCount }` via `queryPayments`, so a row count for any filter set is one fetch away without a new endpoint.
- **Contradiction:** `merchant-console/CLAUDE.md` and `.claude/rules/components.md` both say a `Dialog` primitive already exists alongside Button/Input/Select. It does not — `src/components/` has no `Dialog.tsx`. What exists is `Drawer.tsx`, a Tremor wrapper around `@radix-ui/react-dialog`, and `@radix-ui/react-dialog` is already a dependency. There is no `Checkbox` component either; column selection will use plain styled `<input type="checkbox">`, which stays inside "Tailwind only, reach for what's here before adding a dependency" since nothing here fits and no new package is needed.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Amounts are integer minor units, formatted once at the edge | `merchant-console/CLAUDE.md`, `.claude/rules/money.md` | Re-parsing `formatMoney`'s output for CSV math corrupts totals |
| "Validate on the server... column names... checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md`, `.claude/rules/api-routes.md` | Client-supplied column names reaching `toCsv` or the response header unchecked is exactly the injection risk the ticket calls out |
| "One query builder. Payment filtering goes through the builder behind `GET /api/payments`." | `merchant-console/CLAUDE.md` | A second filter path for "all payments" scope drifts from the real one |
| "Never return a full card number from a list or detail route" | `.claude/rules/api-routes.md` | Not directly touched — export only ever carries `last4`, never the PAN |
| "Dialogs and forms must be operable... accessible name, focus moves in and returns on close, Escape closes it" | `.claude/rules/components.md` | An export dialog ops can't drive with a keyboard is a support ticket of its own |

## Approach

Replace the anchor-tag Export button with a client-side dialog (built directly on `@radix-ui/react-dialog`, the same primitive `Drawer.tsx` already wraps) that lets ops check/uncheck columns from the existing `EXPORT_COLUMNS` list (last4 unchecked by default) and pick scope (current filter, default, or all payments), showing the row count for whichever scope is selected before they download. The dialog computes an export URL — `?columns=...&scope=...` alongside the existing filter params — and Download is a link to it; `GET /api/payments/export` validates `columns` against the `EXPORT_COLUMNS` allowlist and `scope` against `"filtered" | "all"`, chooses `filterPayments(filters)` or `filterPayments({})` accordingly (still the one query builder either way), and builds the filename from the scope.

**Considered and rejected:** building a generic `Dialog` primitive in `src/components/` to match what `CLAUDE.md` claims exists. Rejected because there is exactly one caller today; a reusable abstraction for a single use site is the premature generalization the repo's own conventions warn against. If a second dialog shows up later, that's the time to extract one, using this component as the first real example.

**Considered and rejected:** computing the "all payments" row count with a new `filterPayments({}).length` call from the dialog's own fetch handler. Rejected in favor of hitting `GET /api/payments` for both counts (current filters, and no filters) — it already reuses the one query builder and returns `total`, so no second counting path exists.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `exportFilename` takes a scope label (`"all"`, a status, or `"filtered"`) and stamps it into the name; add `parseExportColumns(param: string \| null)` beside `EXPORT_COLUMNS` so the allowlist check lives next to the list it checks against |
| `src/lib/csv.test.ts` | change | Extend for the new `exportFilename` signature and `parseExportColumns` |
| `src/app/api/payments/export/route.ts` | change | Read `columns` and `scope` from the querystring, validate both server-side, branch to `filterPayments(filters)` vs `filterPayments({})`, reject (400) if the validated column list is empty |
| `src/components/ui/payments/ExportDialog.tsx` | add | The dialog: column checkboxes (last4 off by default), scope choice with live row counts, Download disabled at zero columns |
| `src/app/payments/page.tsx` | change | Swap the `<a>` Export button for `<ExportDialog>`, passing the current query params and `filters.status` |

## Plan

1. **Extend `csv.ts`** — `exportFilename(scope, date?)` and `parseExportColumns(param)`. Done when: existing `csv.test.ts` cases still pass with the signature change reflected.
2. **Extend `csv.test.ts`** — cover `exportFilename` with `"all"`, a status, and no filter (`"filtered"`); cover `parseExportColumns` dropping unknown columns and empty input. Done when: `npm test` is green.
3. **Update the export route** — parse/validate `columns` and `scope`, branch the query, wire the new filename call, 400 on an empty validated column list. Done when: hitting `/api/payments/export?scope=all&columns=id,amount` in the browser returns a two-column CSV of every payment, and `?columns=id;%20DROP%20TABLE` returns only the allowlisted columns, not an error that leaks the input.
4. **Build `ExportDialog`** — trigger button, column checklist defaulting last4 off, scope radio pair, fetch both row counts from `GET /api/payments` on open, Download link disabled when no columns are checked. Done when: opening it, unchecking every column, and confirming Download is disabled, is visible in the browser.
5. **Wire it into `page.tsx`** — pass current query params in, remove the old anchor. Done when: exporting from a filtered `/payments?status=disputed` view downloads `payments-disputed-2026-08-13.csv` with only the checked columns.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops chooses columns; last4 off by default | Manual: open dialog, confirm last4 unchecked; `csv.test.ts` covers `toCsv` honoring a subset (already does) |
| Ops chooses scope; current filter default; row count visible before download | Manual: open dialog on a filtered view, see the smaller count, switch to "all payments", see it change |
| Filename reflects scope and date | `csv.test.ts` case: `exportFilename("disputed", new Date("2026-08-13..."))` → `payments-disputed-2026-08-13.csv` |
| Amounts stay minor units internally, formatted once, currency its own column | Already true in `csv.ts` `cell()`/`formatMoney`; no change needed, just don't regress it |
| Deselecting every column disables Download | Manual: uncheck all, confirm Download is disabled; route also 400s if it somehow gets an empty allowlisted list |

## Risks

- Scope encoding in the filename only handles "all" vs. a single status vs. "filtered" (merchant/search/date filters collapse to "filtered"). Matches the ticket's own example (`payments-disputed-...`); a richer encoding is easy to add later if ops asks.
- Two `GET /api/payments` calls on dialog open (one per scope) add latency to opening the dialog, not to the export itself. Acceptable for an ops tool; would revisit only if the payments table grows enough to make counting itself slow.

## Out of scope

- Streaming/chunked export for very large "all payments" downloads — the store is in-memory and small; not this ticket.
- A reusable `Dialog` primitive in `src/components/` — see Approach.
- NWP-102 (linked ticket) — whatever it covers is separate.

## Open questions

- None blocking. The filename scope-token rule above (`all` / a specific status / `filtered`) is a judgment call made explicit here rather than asked, since the ticket gives one worked example and no further spec.
