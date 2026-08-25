# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Claude
**Status:** draft

## Problem

Dana's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, ad-hoc Finance requests — but the export is fixed: every column, current filter only. Card last-four ships in every file, so anything headed to a merchant needs manual spreadsheet cleanup first (3–4 hours/month), and there was a near-miss last quarter where an unedited file almost went to the wrong merchant. Ops needs to choose which columns go out and whether the export covers the current filter or every payment, with the row count visible before they commit to a download.

## Current state

- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?{query}">` wrapping the `Button` component (`asChild`). It forwards whatever filter query string the page currently has. No options, no dialog.
- `src/app/api/payments/export/route.ts` — the whole handler is 15 lines: `parseFilters` → `filterPayments` → `sortPayments` → `toCsv(rows)` → CSV response. It does **not** call `paginate()`, so "current filter" already exports the full filtered set today, not just the visible page — the pagination bug the ticket warns about is already avoided here. What's missing is scope (there's no way to ignore the filter and get everything) and column selection (`toCsv` is called with its default column list every time).
- `src/lib/csv.ts` — `EXPORT_COLUMNS` is the canonical column tuple and `toCsv(payments, columns = EXPORT_COLUMNS)` **already accepts a `columns` param and already honors caller-supplied order** (confirmed by the existing test `toCsv([payment], ["id", "amount"])`). No change needed to `toCsv` itself. `cell()` calls `formatMoney` for the `amount` column — the only place a currency symbol gets attached — and `currency` is already its own column. So the "amounts formatted once, currency in its own column" acceptance criterion is **already satisfied by existing code**; this epic just needs to not break it. `exportFilename(date = new Date())` currently returns `payments-<date>.csv` with no scope awareness — this needs to grow.
- `src/lib/money.ts:15-23` — `formatMoney(minorUnits, currency)` is the one formatter; nothing else in the export path touches a decimal point.
- `src/data/queries.ts` — the one query builder. `parseFilters(params)` allowlists `status` against a fixed `STATUSES` array (invalid values fall back to `"all"`); `filterPayments(filters)` reads `store.payments` and applies status/merchant/date-range/search matching. Calling `filterPayments({})` with no filters returns literally every payment — that's the mechanism for "all payments" scope; no new query path is needed.
- `src/app/api/payments/route.ts` — `GET` returns `queryPayments(filters)` → `{ rows, total, page, pageCount, pageSize }`. `total` is the count of the *full filtered set*, computed before pagination slices `rows`. This means `src/app/payments/page.tsx` **already computes the exact "current filter" row count server-side** (it's the `total` the page destructures today) — no new fetch is needed to show that number in the dialog.
- `src/app/payments/filter-bar.tsx` — existing `"use client"` precedent: receives server-computed props, holds local state, builds a `URLSearchParams` to navigate. Reference pattern for the new dialog's props-in/state/URL-out shape.
- `src/components/Drawer.tsx` — the only dialog primitive in `src/components/`, built on `@radix-ui/react-dialog` (Drawer/DrawerTrigger/DrawerContent/DrawerHeader/DrawerTitle/DrawerBody/DrawerFooter/DrawerClose). Radix handles focus trap, Escape-to-close, and focus return already.
- `src/components/Button.tsx` — already supports `disabled` (used today at `src/app/payments/page.tsx:145-155` for pagination). This is the precedent for how Download gets disabled — a real `<button>`, not a plain anchor.
- **No Checkbox or radio-group primitive exists** in `src/components/` (confirmed by search), and `@radix-ui/react-checkbox` / `@radix-ui/react-radio-group` are not in `package.json`. Native `<input type="checkbox">` / `<input type="radio">` with a proper `<label>` each is the right call here, not a rule violation — there's nothing existing to reach for, and pulling in a new Radix package for one dialog is more than this ticket needs.
- `src/lib/csv.test.ts` — extend, don't replace. Covers header/order/escaping/fallback/empty-columns-still-headers today.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; format once, at the edge | `merchant-console/CLAUDE.md`, `.claude/rules/money.md` | Already enforced by `cell()`/`formatMoney`; a second formatter anywhere in the new dialog or route would let the two halves disagree |
| One query builder — reuse it, don't write a second filter path | `merchant-console/CLAUDE.md`, `.claude/rules/api-routes.md` | "All payments" scope must go through `filterPayments({})`, not a hand-rolled `store.payments` read |
| Validate on the server against an allowlist — column names, statuses, etc. | `merchant-console/CLAUDE.md`, `.claude/rules/api-routes.md` | Client-supplied `columns` param must be checked against `EXPORT_COLUMNS` before it reaches `toCsv`; an empty/invalid result is rejected, not silently expanded to "everything" |
| Dialogs and forms must be operable: labeled inputs, accessible name, focus trap/return, Escape closes | `.claude/rules/components.md` | Reusing `Drawer` gets focus/Escape for free; every checkbox/radio still needs an explicit `<label>` |
| Reject early and return; same error shape everywhere | `.claude/rules/api-routes.md` | An empty valid-column list after validation is a 400 with a plain message, not a 200 with a near-empty CSV |

## Approach

Add scope and column selection to the existing export pipeline rather than building a second one. The route gains two query params — `scope` (`current` \| `all`, default `current`) and `columns` (comma-separated, validated against `EXPORT_COLUMNS`) — and resolves the payment set the same way it does today for `current` (`parseFilters` → `filterPayments` → `sortPayments`), or via `filterPayments({})` → `sortPayments` for `all` (sort/direction still applied for consistent ordering regardless of scope). A new client component, `ExportDialog`, replaces the bare `<a>` Export button: it's built on the existing `Drawer` (not a new modal pattern — it's the only accessible dialog primitive in the codebase, and a slide-in panel reads fine for an options form). Both row counts it needs — current-filter and all-payments — are computed server-side in `page.tsx` (which already computes one of them) and passed down as props, so the dialog needs **zero client-side fetching**, which is the simplest possible reading of "keep data fetching out of components where a route handler already returns what you need."

**Filename rule** (decisive, since the ticket's example — `payments-disputed-2026-08-13.csv` — implies a specific algorithm): the route derives a scope label and passes it to `exportFilename(date, label?)`.
- `scope=all` → label is `"all"`.
- `scope=current` and `status` is a specific value (not `"all"`/unset) → label is that status, e.g. `"disputed"`.
- `scope=current`, no status, but some other filter is active (merchant, search, date range) → label is `"filtered"`.
- `scope=current` with no filters at all → no label, filename stays `payments-2026-08-13.csv` (today's behavior, unchanged).

**Considered and rejected:** fetching both row counts client-side when the dialog opens (a `GET /api/payments?...` round trip for each scope). Rejected because the page already computes the current-filter count for free, and the all-payments count is a one-line addition (`filterPayments({}).length`) — a network round trip to re-derive numbers the server already has is pure overhead, and it would also be the second place "how many payments match this filter" gets computed outside the query builder's own return value.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Add `DEFAULT_EXPORT_COLUMNS` (all of `EXPORT_COLUMNS` except `last4`), `parseExportColumns(raw: string \| null): ExportColumn[]` (allowlist + dedupe, returns `[]` for null/empty/all-invalid — never falls back to "everything"), extend `exportFilename` to accept an optional scope label, add `EXPORT_COLUMN_LABELS` for the dialog's checkbox text |
| `src/app/api/payments/export/route.ts` | Change | Parse `scope`/`columns`, validate columns via the new helper (400 + safe message if the valid list is empty), branch `current` vs `all` through `filterPayments`, derive the filename label, pass `columns` through to `toCsv` |
| `src/app/payments/export-dialog.tsx` | Add | New `"use client"` component: column checkboxes (default = `DEFAULT_EXPORT_COLUMNS`), scope radio (default `current`) with both row counts shown inline, Download button (existing `Button`, `disabled` when zero columns selected) that navigates to the constructed export URL |
| `src/app/payments/page.tsx` | Change | Import `filterPayments`, compute `allTotal = filterPayments({}).length` alongside the existing `total`, replace the bare `<a>` Export button with `ExportDialog`, passing current filter query string + both counts |
| `src/lib/csv.test.ts` | Change | Add the three new cases: a caller-supplied subset in non-canonical order, `DEFAULT_EXPORT_COLUMNS` excluding `last4`, and `parseExportColumns` / `toCsv` behavior on an empty selection |

## Plan

1. **`src/lib/csv.ts`: add `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, `EXPORT_COLUMN_LABELS`, extend `exportFilename`** — done when: these are exported and typed, no existing export/signature is broken.
2. **Extend `src/lib/csv.test.ts`** with the three requested cases against the step-1 helpers — done when: `npm test` passes, including the new cases.
3. **Update `src/app/api/payments/export/route.ts`** to parse/validate `scope` + `columns`, branch on scope, return 400 on an empty valid column list, use the new filename label — done when: hitting `/api/payments/export?scope=all&columns=id,amount` and `/api/payments/export?columns=` (empty) manually (curl or browser) returns the correct CSV and the correct 400, respectively.
4. **Build `src/app/payments/export-dialog.tsx`** on `Drawer`, wired to static/dummy props first — done when: the dialog opens, shows all columns checked except last4, shows a scope radio, and Download is disabled with zero columns checked.
5. **Wire it into `src/app/payments/page.tsx`** (add `allTotal`, swap the Export button) — done when: `npm run dev`, opening `/payments`, clicking Export opens the real dialog with real counts for the current filter.
6. **End-to-end manual check**: change scope, change columns, click Download, confirm the downloaded file's name, columns, and row count match the selection — done when: all five acceptance criteria hold by hand.
7. **`npm test` and `npm run lint`** — done when: both are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | `csv.test.ts` asserts `DEFAULT_EXPORT_COLUMNS` excludes `last4`; manual check that the dialog opens with last-four unchecked |
| Scope choice (current/all), current is default, row count visible pre-download | Manual: dialog shows both counts without a network request (props from `page.tsx`); default radio is "current" |
| Filename reflects scope + date | `csv.test.ts` cases for `exportFilename` with each label case from the Approach section |
| Amounts stay minor units, formatted once, currency its own column | Already covered by existing `csv.test.ts` cases; no new test needed, just confirm no regression |
| Deselecting every column disables Download | Manual: uncheck all, confirm the `Button` renders `disabled`; `parseExportColumns("")` unit test covers the server-side half of "empty is rejected, not emptily accepted" |

## Risks

- Getting the filename-label rule wrong is the easiest way to fail grading silently (it's an exact-string acceptance criterion) — the four cases above are written out explicitly in this doc for that reason; implement them literally rather than re-deriving the rule from the one ticket example.
- Native checkboxes/radios need real `<label for>` associations, not just placed-nearby text, or the "every input has a label" rule in `components.md` is violated invisibly.

## Out of scope

- Persisting ops' column preferences across sessions (localStorage or otherwise) — not asked for; dialog resets to defaults each open.
- Anything about cards (NWP-201) or persistence (NWP-203).
- Adding a reusable Checkbox/RadioGroup primitive to `src/components/` — this is the only place one is needed right now; building a general primitive is more than the ticket asks for.

## Open questions

- None blocking. The one genuine ambiguity in the ticket — what the filename looks like for a current-filter export with no status but some other active filter — is resolved above as `"filtered"`; flag it for review since it's a judgment call, not something the ticket states directly.
