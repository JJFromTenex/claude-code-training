# SPEC · NWP-101 — Payments export: choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Mariana Small (with Claude)
**Status:** done

## Problem

Dana's ops team exports payments several times a day, but the file is fixed: every column, current filter only. Card last-four is in every file, so anything going to a merchant is cleaned by hand first: 3–4 hours a month, plus a near-miss where an unedited file almost went to the wrong merchant.

## Current state

All paths are under `build-battle/merchant-console/`.

- `src/app/payments/page.tsx:68-76`: the Export button is a plain link to `/api/payments/export?<current query>`. No dialog and no options.
- `src/app/api/payments/export/route.ts:11-25`: the export is already server-side and runs through the query builder (`parseFilters` → `filterPayments` → `sortPayments`). It exports **every filtered row, not one page**, so the pagination trap in the ticket notes is already avoided. Columns and filename are fixed.
- `src/data/queries.ts:18-36`: `parseFilters` is the allowlist for status, sort and direction. `filterPayments` (`:45`) is "the one payment query builder". `queryPayments` (`:102`) returns `total`, which is the row count we need.
- `src/app/api/payments/route.ts`: `GET /api/payments` returns `{ rows, total, page, pageCount }`. It can supply the pre-download row count without a new endpoint.
- `src/lib/csv.ts:13-24`: `EXPORT_COLUMNS` is already the full column allowlist (10 columns, including `last4`). `toCsv(payments, columns)` (`:58`) already accepts a column subset. `exportFilename(date)` (`:69`) has no scope segment.
- `src/lib/csv.test.ts`: it pins escaping, the column contract and `exportFilename(date)` → `payments-2026-03-14.csv`. Its header says these "should still pass afterwards".
- `src/lib/money.ts:15`: `formatMoney` is the only formatter. The `amount` cell already uses it, and `currency` is already its own column.
- `src/components/Drawer.tsx`: a Radix Dialog wrapper that is already accessible. **Mismatch:** `.claude/rules/components.md` says a `Dialog` component exists, but there is no `Dialog.tsx`. There is also no Checkbox component.
- **Not this ticket, noticed:** `sortPayments` (`queries.ts:81`) sorts amounts as strings, so `9000` sorts above `10000`. `page.tsx:36-43` re-implements status parsing instead of calling `parseFilters`. `parseFilters` passes `merchantId`, `from` and `to` through unvalidated.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units… Format once, at the edge, next to its currency code." | app `CLAUDE.md` #1 | Cents drift; amounts float |
| "One query builder… A second implementation is a bug" | app `CLAUDE.md` #3 | Export and table disagree |
| "Anything from the client — column names… — is checked against an allowlist before it reaches a query, a filename, or the store." | app `CLAUDE.md` #4 | Arbitrary headers or filenames |
| "Client-side checks are a convenience, never the enforcement." | `rules/api-routes.md` | A crafted URL bypasses the UI |
| "Card last-four is **off** by default." | ticket AC1 | The near-miss happens again |
| "Every input has a label… focus moves into it… Escape closes it." | `rules/components.md` | Unusable dialog |

## Approach

The Export button opens an options panel built on the existing `Drawer`. The panel has one checkbox per allowlisted column (all on except `last4`), a scope choice ("Current filter" default, or "All payments"), and a live row count fetched from `GET /api/payments`. **Download** builds `/api/payments/export?scope=…&columns=…` plus the current filters, and is disabled when no column is ticked. On the server, a new `parseExportOptions` in `src/lib/csv.ts` validates `columns` and `scope` against allowlists and rejects anything unknown or empty with a 400. "All payments" runs `filterPayments` with empty filters, so it still goes through the one builder. `exportFilename` gains an optional, allowlisted scope label.

**Considered and rejected:** building the CSV in the browser from the table's rows. It would export only the visible page of 20, which the ticket names as the bug to avoid, and it would put column validation on the client. Also rejected: a new `Dialog` component, because `Drawer` is already a Radix Dialog with focus and Escape handling.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add `DEFAULT_EXPORT_COLUMNS` (no `last4`), `parseExportOptions` (allowlist columns and scope), and an optional scope label in `exportFilename` |
| `src/lib/csv.test.ts` | change | Extend with tests for defaults, rejection, empty set, order, and filename label. Existing tests stay green |
| `src/app/api/payments/export/route.ts` | change | Call `parseExportOptions`, return 400 on invalid input, pick filters by scope, pass columns and label through |
| `src/app/payments/export-dialog.tsx` | add | Client component: Drawer, column checkboxes, scope radios, row count, Download |
| `src/app/payments/page.tsx` | change | Replace the Export link with the dialog trigger; pass the current query string |

## Plan

1. **Server-side options in `csv.ts`, test-first.** Done when: the new `csv.test.ts` cases pass and the old ones still pass (`npm test`).
2. **Wire the export route.** Done when: `?columns=id,amount` returns two columns; `?columns=id,bogus` and `?columns=` both return 400; `?scope=all` ignores filter params; the filename reads `payments-disputed-<date>.csv` or `payments-all-<date>.csv`.
3. **Build `export-dialog.tsx`.** Done when: it opens from Export, last-four is unticked, the row count updates when scope changes, and Download is disabled with zero columns.
4. **Swap it into `page.tsx`.** Done when: filtering by Disputed, opening Export and downloading gives a file whose row count matches the dialog and that has no `last4` column.
5. **`npm test` + `/ship-ready`.**

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last-four off by default | Unit test: default set excludes `last4`. Manual: dialog shows it unticked |
| Scope current/all; current default; count visible | Manual: count matches the table footer total; switching to All shows the store total |
| Filename reflects scope and date | Unit test on `exportFilename(date, "disputed")`; check the downloaded name |
| Minor units internally, formatted once, currency own column | Existing `toCsv` amount tests; no new formatter (grep for `toFixed`/`Intl` in diff) |
| No columns → Download disabled, not empty file | Manual: button disabled. Server: `?columns=` → 400 (unit test on `parseExportOptions`) |
| Column names validated server-side | Unit test: unknown column rejected; manual curl → 400 |

## Risks

- **Filename label from client input.** Only allowlisted values may reach it: a parsed status, `all`, or `filtered`. Never the raw `merchantId` or search text.
- **Breaking old links.** `/api/payments/export` with no `columns` should still work, so default to `DEFAULT_EXPORT_COLUMNS` instead of returning a 400.
- **Row count drift.** The dialog count and the file both go through `filterPayments`, so they can't diverge unless the filters passed differ. Pass the identical query string to both.

## Out of scope

- Fixing amount sort (`queries.ts:81`), the duplicate status parsing in `page.tsx`, and validating `merchantId`/`from`/`to`. Flag as follow-ups.
- Saved column presets, XLSX, emailing the file (NWP-102 is related; not read for this spec).
- Persistence (NWP-203).

## Open questions (decided, override if wrong)

- **Filename label for a non-status filter** (merchant or search only): use `payments-filtered-<date>.csv`, never the merchant id. *Recommended.*
- **Amount without currency:** if `amount` is ticked, the server adds `currency` too, so an amount never ships without its code. *Recommended.*
- **Unknown column:** reject the whole request (400) instead of silently dropping it. Matches "reject early".
