# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Beshoy Eskarous
**Status:** draft

## Problem

Ops runs the payments export several times a day — merchant queries, month-end reconciliation, Finance requests — and always gets every column at a fixed scope. Card last-four ships in every file, so anything going to a merchant has to be scrubbed by hand first: 3–4 hours a month, and a near-miss last quarter where an unedited file nearly reached the wrong merchant.

## Current state

- `src/app/api/payments/export/route.ts` already exists. Its own docstring says: *"Honors the active filters and reuses the query builder, but the column set and the scope are fixed. Giving ops control over both is NWP-101."* It calls `filterPayments(filters)` then `sortPayments(...)` from `src/data/queries.ts` — **no `paginate()` call** — so it already exports every row matching the current filter, not just the current page. The pagination bug the ticket warns about is already avoided for this case; there's nothing to fix here, only to extend.
- `src/lib/csv.ts`'s `toCsv(payments, columns = EXPORT_COLUMNS)` already accepts an optional column subset, in order. The plumbing for column choice exists; nothing selects a subset yet.
- `src/lib/csv.ts`'s `cell()` already formats `amount` via `formatMoney` only inside that one switch case, and `currency` is already its own column. AC #4 (minor units internally, formatted once at the edge, currency in its own column) is **already satisfied** by existing code — this epic must not touch that logic, only reuse it.
- `src/lib/csv.ts`'s `exportFilename(date = new Date())` returns `payments-<date>.csv` with no scope segment. This is the one real gap in `csv.ts`.
- `src/lib/csv.test.ts` pins the escaping, column-order, and filename-date behavior today, with an explicit comment: *"NWP-101 changes which columns ship, not how a cell is written, and these should still pass afterwards."* Per the ticket's DoD, extend this file — do not start a new one.
- `src/data/queries.ts` is the one query builder (`parseFilters`, `filterPayments`, `sortPayments`, `paginate`, `queryPayments`). `filterPayments(filters)` alone (no `paginate`) is exactly "every row matching a filter" — reusable as-is for both scopes: `filterPayments(parseFilters(...))` for "current filter", `filterPayments({})` for "all payments" (its filter logic short-circuits on every falsy field, so an empty `PaymentFilters` object returns every payment — confirmed by reading the function, no change needed there).
- `src/app/api/payments/route.ts` returns `queryPayments(filters)` = `{ rows, total, page, pageCount, pageSize }`. `total` is the pre-pagination count matching a filter — reusable as-is to show a row count before download, for either scope.
- `src/app/payments/page.tsx` — the Export button is a plain `<a href="/api/payments/export?...">`, no dialog.
- `.claude/rules/components.md` states *"`src/components/` already has Button, Input, Select, Dialog, Badge, and the rest"* — there is **no `Dialog` component**. The closest primitive is `src/components/Drawer.tsx`, built on `@radix-ui/react-dialog`, which already gives focus-trapping and Escape-to-close. This epic builds the options UI on `Drawer`, not a nonexistent `Dialog` or a new dependency.
- No checkbox/radio-group component exists, and `package.json` has no `@radix-ui/react-checkbox` or `@radix-ui/react-radio-group`. Plain labelled `<input type="checkbox">` / `<input type="radio">`, styled with Tailwind, is the right call — consistent with "Tailwind only" and no new dependency.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units... Format once, at the edge, next to its currency code." | `build-battle/merchant-console/CLAUDE.md` | Already satisfied by `cell()` in `src/lib/csv.ts` — touching this would be a regression, not an improvement |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `build-battle/merchant-console/CLAUDE.md`, `.claude/rules/api-routes.md` | An unvalidated column name or scope value reaching the filename or the CSV columns is an injection / header-manipulation surface |
| "Payment filtering goes through the builder behind `GET /api/payments`... A second implementation is a bug, not a shortcut." | `build-battle/merchant-console/CLAUDE.md` | Export and table silently disagree on what a filter means |
| "Column names arrive from the client, so validate them server-side. Do not interpolate them into SQL." | `docs/tickets/NWP-101.md` | Restates the allowlist rule; this ticket is the reason it exists |
| "The payments table is paginated. Building this in the browser exports the current page only." | `docs/tickets/NWP-101.md` | Client-built export silently drops rows past page 1 |

## Approach

Extend the existing export route with two validated query params — `columns` (comma-separated, checked against `EXPORT_COLUMNS`) and `scope` (`"current" | "all"`) — and extend `exportFilename` with an optional scope-slug segment. Add a client-side `ExportDialog`, built on `Drawer`, that defaults to every column except `last4` and scope `current`, shows a live row count pulled from the existing `GET /api/payments`, and disables Download when zero columns are selected. The filename's scope slug: the active `status` filter if set, else `"filtered"` if any other filter is active, else `"all"` — for `scope=all` the slug is always `"all"`.

**Considered and rejected:** building the CSV client-side from rows already fetched for the visible table page. Rejected because the table is paginated (`PAGE_SIZE = 20` in `src/data/queries.ts`) and the ticket names this exact failure as "the bug we would be shipping instead of the feature."

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | `exportFilename` gains an optional scope-slug param |
| `src/lib/csv.test.ts` | extend | pin the new filename behavior, plus column-selection cases (subset/order, last-four-off default, empty selection) |
| `src/app/api/payments/export/route.ts` | change | parse/validate `columns` + `scope`, pick `filterPayments(filters)` vs `filterPayments({})`, pass the slug to `exportFilename` |
| `src/app/payments/export-dialog.tsx` | add | the options dialog: column checklist, scope radios, live row count, Download link |
| `src/app/payments/page.tsx` | change | Export button opens the dialog instead of linking straight to the route |

## Plan

1. **Extend `exportFilename` in `src/lib/csv.ts`** with an optional scope-slug argument, appended between `payments` and the date. — done when: the existing filename test (no slug argument) still passes unchanged, and a new case with a slug passes.
2. **Extend `src/app/api/payments/export/route.ts`** to parse and validate `columns` (against `EXPORT_COLUMNS`, reject the request on any unknown name or an empty list) and `scope` (`current`/`all`, default `current`), route to `filterPayments(filters)` or `filterPayments({})` accordingly, and compute the filename slug. — done when: hitting the route directly with valid and invalid `columns`/`scope` values in the browser returns the right CSV/filename or a 400.
3. **Build `src/app/payments/export-dialog.tsx`** on `Drawer`: column checkboxes (default = `EXPORT_COLUMNS` minus `last4`), scope radios (default `current`), a live row count fetched from `GET /api/payments`, Download disabled at zero columns. — done when: opening it on `/payments` shows correct defaults and the count updates with scope.
4. **Wire the dialog into `src/app/payments/page.tsx`**'s Export button. — done when: clicking Export opens the dialog, and Download produces the file verified in step 2.
5. **Run `npm test`** and manually walk every acceptance criterion against the dev server.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | `csv.test.ts` case for a chosen subset in order; dialog opens with `last4` unchecked |
| Scope current/all, current is default, row count visible before download | Manual: toggle scope in the dialog, watch the count change before downloading |
| Filename reflects scope and date | `csv.test.ts` case(s) on `exportFilename` with a slug; manual check of the `Content-Disposition` header |
| Amounts stay minor units internally, formatted once, currency its own column | Already covered by existing `csv.test.ts` cases — confirm untouched |
| Deselecting every column disables Download | `csv.test.ts` case for an empty column list; dialog manual check that Download is `disabled` |

## Risks

- The route becomes a second decision point for "all" vs "current" filters — it must stay a thin wrapper over `filterPayments`, never new filter logic.
- The live row-count fetch adds a network round trip per dialog open/scope-change — acceptable for an internal ops tool.
- The `"filtered"` fallback slug means two different filter combinations (e.g. merchant-only vs. search-only) can produce the same filename on the same day — acceptable; the existing pinned filename test already documents that two exports on the same day "collide by design."

## Out of scope

- NWP-102, whatever it covers.
- Remembering ops' last-used column selection across sessions.
- A general-purpose `Dialog` component for the rest of the app — this epic uses `Drawer` for the one dialog it needs.

## Open questions

- None. The filename-slug ambiguity (what to use when the active filter isn't a status) was resolved: status if set, else `"filtered"`, else `"all"`.
