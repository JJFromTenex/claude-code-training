# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** hdunbar@mycervello.com
**Status:** draft

## Problem

Ops exports the payments table several times a day, and every file ships with every column, including the card last-four, whether or not it is headed to a merchant. Dana's team spends 3-4 hours a month cleaning files by hand before they can be sent out, and had a near-miss last quarter where an unedited file almost reached the wrong merchant. They need to choose what's in the file before it leaves the building.

## Current state

- `src/app/payments/page.tsx` (around line 68) — the Export control is a plain `<a href="/api/payments/export?...">` link carrying the page's current query string. No dialog, no column or scope choice.
- `src/app/api/payments/export/route.ts` — `GET` parses filters with `parseFilters`, calls `filterPayments` + `sortPayments` from `src/data/queries.ts`, and pipes the result through `toCsv` using the default column set. `filterPayments` already returns every matching row unpaginated (pagination is a separate step `queryPayments` applies on top), so this route does not have the "exports the current page only" bug the ticket warns about — that needs to stay true.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` is the fixed, full list, including `last4`. `toCsv(payments, columns)` already accepts an optional, ordered column subset — the serializer is column-aware today, it's just never called with anything but the default. `cell()` is an exhaustive switch over the `ExportColumn` union, so an unrecognized string is only caught by TypeScript at compile time; there is no runtime allowlist check, which is what the ticket's server-validation note is about. `exportFilename(date)` stamps only the date, nothing about scope.
- `src/data/types.ts` — `PaymentFilters` has no notion of "scope." Ops's two scopes map to two different filter sets, not a new field: "current filter" is today's `filters`, "all payments" is the same query with `status`/`merchantId`/`search`/`from`/`to` cleared.
- `src/app/payments/filter-bar.tsx` — exposes status, merchant, and free-text search. `PaymentFilters` also carries `from`/`to`, but the filter bar doesn't surface date inputs, so "current filter" scope is bounded by whatever the filter bar actually offers today.
- Components: there is no `Dialog.tsx`. `src/components/Drawer.tsx` is the Radix `react-dialog` wrapper Tremor named "Drawer" — it's the modal primitive this codebase actually has. `src/components/DropdownMenu.tsx` exports `DropdownMenuCheckboxItem`, a ready-made checkbox row, in case the column picker is better as a menu than a checklist inside the drawer.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Validate anything from the client against an allowlist before it reaches a query, a filename, or the store | `build-battle/merchant-console/.claude/rules/api-routes.md` | A crafted `columns` param reaches `cell()`'s switch or the response filename unvalidated |
| One query builder; a second implementation is a defect | `build-battle/merchant-console/.claude/rules/api-routes.md` | "All payments" scope drifts from what `filterPayments`/`GET /api/payments` actually consider a payment |
| Money is integer minor units; format once, at the edge | `build-battle/merchant-console/.claude/rules/money.md` | Amount column double-formats or drifts if a new code path bypasses `formatMoney` in `cell()` |
| Card last-four is masked everywhere except the single creation response | `build-battle/merchant-console/.claude/rules/cards.md` | Repeats the near-miss Dana described if `last4` ships in a merchant-bound file by default |

## Approach

Extend the existing pieces rather than adding a parallel path: `toCsv` already takes a column subset, and `filterPayments` already returns unpaginated rows, so the export route mainly needs a validated `columns` param and a `scope` param that either passes today's filters through or clears them before calling the same query builder. The "row count before download" requirement doesn't need a new endpoint — `GET /api/payments` already returns `total` in its paginated response, and the payments page already computes `total` for the current filter at render time. The dialog can take that `total` as a prop for "current filter" scope, and make one client-side call to the existing `GET /api/payments` (page=1, no filters) for "all payments" scope, reading `.total` off the response.

**Considered and rejected:** a dedicated `/api/payments/export-count` route that just returns a row count. Rejected because it would be a second, narrower implementation of a query `GET /api/payments` already answers — exactly the kind of duplication the "one query builder" rule flags.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Add a server-side column allowlist check (reject/drop anything not in `EXPORT_COLUMNS`); extend `exportFilename` to take a scope descriptor and fold it into the name |
| `src/lib/csv.test.ts` | Change | Cover the new allowlist check and the new `exportFilename` signature — this is the "unit test covers the column serializer" from the Definition of Done |
| `src/app/api/payments/export/route.ts` | Change | Accept and validate `columns` and `scope` query params; resolve `scope=all` to an empty filter set before calling `filterPayments`; build the filename from the resolved scope |
| `src/app/payments/export-dialog.tsx` | Add | Client component: column checklist (last-four unchecked by default), scope choice, row-count readout, Download disabled when no columns are selected |
| `src/app/payments/page.tsx` | Change | Replace the plain Export `<a>` with the trigger for `PaymentsExportDialog`, passing the current filters and the already-known `total` |

## Plan

1. **Add the column allowlist check and scope-aware `exportFilename` to `src/lib/csv.ts`, extend `src/lib/csv.test.ts`** — done when: `npm test` passes with new cases for an unrecognized column and the new filename shape.
2. **Update `src/app/api/payments/export/route.ts` to read and validate `columns`/`scope`** — done when: a manual request with `columns=id,amount&scope=all` returns a two-column CSV covering every payment regardless of the active filter, and an unrecognized column in the query string never reaches the output header.
3. **Build `PaymentsExportDialog`** — done when: opening it on `/payments` shows every `EXPORT_COLUMNS` entry checked except `last4`, switching scope updates the displayed row count, and unchecking every column visibly disables Download.
4. **Wire the dialog into `src/app/payments/page.tsx`** — done when: clicking Export opens the dialog instead of downloading immediately, and confirming downloads a CSV whose filename and contents match what was chosen.
5. **Run `npm test`, then walk every acceptance criterion by hand against `npm run dev`** — done when: each AC in the ticket is confirmed against real browser behavior.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Manual: dialog opens with `last4` unchecked. `csv.test.ts` already proves `toCsv` honors an arbitrary column subset/order |
| Ops can choose scope (current filter default), row count visible before download | Manual: default count matches the page's existing "N payments" footer; switching to "all payments" updates the count before Download is clickable |
| Filename reflects scope and date | New case in `csv.test.ts` for `exportFilename(date, scope)` |
| Amounts stay in minor units internally, formatted once, currency its own column | Already true (`cell()` calls `formatMoney` once; `currency` is a separate column) — existing `csv.test.ts` cases re-run as a regression check |
| Deselecting every column disables Download | Manual: uncheck every box in the dialog, confirm Download is disabled rather than producing a header-only file |

## Risks

- The "all payments" row count depends on `GET /api/payments`'s response shape staying `{ total, ... }`. Reading only that documented field keeps this from breaking silently if the route changes for an unrelated reason.
- Column validation failure mode (silently drop vs. reject the request) isn't specified by the ticket — see Open questions. Picking the wrong one is easy to change later since it's isolated to one helper in `csv.ts`.

## Out of scope

- NWP-102 — linked as related, not investigated here.
- Persisting an ops user's last-chosen columns or scope. Nothing in the ticket asks for it, and the store is in-memory and ephemeral anyway.
- Adding date-range inputs to `PaymentsFilterBar`. `PaymentFilters` already supports `from`/`to` and the export route already forwards them, but exposing them in the UI is a separate change.

## Open questions

- The ticket gives one filename example (`payments-disputed-2026-08-13.csv`) for a status-filtered export. What should the filename say when scope is "current filter" but the active filter is a merchant or free-text search instead of status, when several filters are active at once, or when scope is "all payments"? Proposing `all` for the all-payments scope and the status value when status is the filter in play, otherwise `filtered` — needs confirmation before step 1 locks in the signature.
- Should an unrecognized value in `columns` be dropped silently or make the request fail with a 400? The ticket says to validate, not what a validation failure should look like to the caller.
- Is a purpose-built checklist inside `Drawer` the right shape for the column picker, or does `DropdownMenuCheckboxItem` (already in `src/components/DropdownMenu.tsx`) fit better? Nothing existing combines a scope choice, a column list, and a live count, so there's no local pattern to copy.
