# SPEC · NWP-101 — Payments export: choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Douglas Gimli
**Status:** building

## Problem

Ops exports the payments table several times a day, and the file is fixed: every column, current filter only. Because the card last-four is always included, anything bound for a merchant is cleaned up by hand first, about 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant. Ops needs to choose columns and scope before the download starts.

## Current state

- `src/app/payments/page.tsx` — the Export button is a plain anchor to `/api/payments/export?<current filters>`. No dialog, no client state. The table is paginated (`PAGE_SIZE = 20`), so anything built in the browser would see one page.
- `src/app/api/payments/export/route.ts` — `GET` calls `parseFilters`, then `filterPayments` and `sortPayments` from `src/data/queries.ts` with no pagination, and returns `toCsv(rows)` with the default column set. Scope and columns are fixed.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` lists ten columns including `last4`. `toCsv(payments, columns)` already accepts an ordered column subset. `cell()` formats `amount` once via `formatMoney` and writes `currency` as its own column. `exportFilename(date)` produces `payments-YYYY-MM-DD.csv` from the UTC date, with no scope.
- `src/lib/csv.test.ts` — nine tests pin escaping, the header contract, the column subset, and the UTC filename date.
- `src/data/queries.ts` — `parseFilters` is the allowlist for status, sort, direction, and page. `queryPayments` returns `total`, the full filtered count, which is what `GET /api/payments` serves.
- `src/components/Drawer.tsx` — wraps Radix Dialog. The components rule names a Dialog component, but none exists; Drawer is the modal primitive in this codebase.
- Ticket versus code: the ticket's warning about a client-side export is real (the page is paginated). Its "reuse the query builder" note is already honoured by the route today and must stay that way.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; format once, at the edge, next to its currency code | `build-battle/merchant-console/CLAUDE.md` convention 1, `.claude/rules/money.md` | A second formatter or arithmetic on `$250.00` |
| Storage and bucketing are UTC | convention 2 | Filename date drifts by a day for anyone west of Greenwich |
| One query builder behind `GET /api/payments`; a second implementation is a bug | convention 3, `docs/ORG-STANDARDS.md` item 6 | Export and table disagree about which rows match |
| Validate every client value against an allowlist before it reaches a query, a filename, or the store | convention 4, `.claude/rules/api-routes.md`, `ORG-STANDARDS.md` item 7 | Column names from the URL land in a file or a lookup unchecked |
| Dialogs and forms must be operable: labels, accessible name, focus in and back, Escape closes | `.claude/rules/components.md` | Unusable with a keyboard or screen reader |
| Extend `src/lib/csv.test.ts`; do not start a new file for the serializer | ticket Definition of done | Split coverage the grader does not find |

## Approach

Keep the export server-side and add two validated query parameters to the existing route: `columns` (comma-separated, checked against `EXPORT_COLUMNS`) and `scope` (`current` or `all`). Parsing lives in `src/lib/csv.ts` beside `toCsv`, so the ticket's serializer tests cover it. Any rejected value returns 400 with a user-safe message rather than a defaulted file. `scope=all` skips the filter fields but still goes through `filterPayments` and `sortPayments`, so there is one query path. The filename becomes `payments-<token>-<UTC date>.csv`, where the token is `all`, the validated status, or `filtered`. On the page, a client component built on the existing Drawer replaces the anchor: column checkboxes with `last4` unchecked, scope radios, a live row count read from `total` on `GET /api/payments`, and a Download anchor that is disabled when no column is checked.

**Considered and rejected:** building the CSV in the browser from the rows on screen. The table is paginated, so it would export one page and ship the exact bug the ticket warns about. Also rejected: a new `/api/payments/count` endpoint. `GET /api/payments` already returns the filtered `total`. Also rejected: adding a Dialog component or a checkbox dependency. Drawer already wraps Radix Dialog, and native inputs with labels meet the components rule.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, `parseExportScope`, `exportScopeToken`; `exportFilename` takes the scope token |
| `src/lib/csv.test.ts` | change | Cover subset in requested order, `last4` excluded by default, empty and unknown and duplicate selections, scope parsing, filename token; update the filename test to the new contract |
| `src/app/api/payments/export/route.ts` | change | Validate `scope` and `columns`, return 400 on rejection, ignore filters for `scope=all`, keep no pagination |
| `src/app/api/payments/export/route.test.ts` | add | Route-level happy path, `scope=all` row count, and the 400 cases |
| `src/app/payments/export-dialog.tsx` | add | Client component: Drawer, column checkboxes, scope radios, row count, Download |
| `src/app/payments/page.tsx` | change | Mount the dialog in place of the plain export anchor, passing the current filter query without `page` |

## Plan

1. **Column parser and default set in `csv.ts`, tests first** — done when: `npx vitest run src/lib/csv.test.ts` passes with new tests for subset order, `last4` off by default, empty, unknown, and duplicate selections.
2. **Scope parser and filename token, tests first** — done when: tests pass for `current`/`all`/invalid and for the token rules including `payments-disputed-2026-08-13.csv`.
3. **Route handler** — done when: `curl ".../export?columns=id,pan"` returns 400, `columns=id,amount` returns a two-column file, `scope=all&status=disputed` returns every payment, and `npm test` is green.
4. **Export dialog component** — done when: `npm run build` and `npm run lint` pass with the component present.
5. **Mount on `/payments`** — done when: on `/payments?status=disputed` the dialog shows the same count as the table footer, switching to all shows the full total, unchecking every column disables Download, and the downloaded file has no `last4` column.
6. **Sync this spec, run `/ship-ready`** — done when: status is `done`, `npm test`, `npm run build`, `npm run lint` all pass, and `git status --short` shows only feature files.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Unit tests in `csv.test.ts` for the parser and default set; route test asserts the default header has no `last4`; dialog opens with `last4` unchecked |
| Scope: current filter or all; current default; row count visible | Route test: `scope=all` ignores `status`; dialog shows `total` from `GET /api/payments`; manual check against the table footer (33 disputed, 1658 all against the seed) |
| Filename reflects scope and date | Unit test asserts `payments-disputed-2026-08-13.csv` and `payments-all-…`; route test reads the content-disposition header |
| Amounts stay in minor units, formatted once, currency own column | Existing `toCsv` tests plus a route test for `columns=amount,currency` producing `$250.00,USD` |
| Deselecting every column disables Download | Manual check in the dialog; route test returns 400 for `columns=` so no empty file can be produced |
| `npm test` passes, serializer test extended in `csv.test.ts` | Test summary recorded in the PR: 28 passing before, all passing after with the new count |

## Risks

- `NextRequest` may not construct cleanly under vitest. If so, drop the route test file and keep every validation branch unit-tested in `csv.ts`; the route becomes glue only.
- Changing `exportFilename`'s signature touches an existing test. The test is updated to the new contract, never deleted, and the UTC-date assertion stays.
- `sortPayments` compares amounts as strings. The export inherits that when `sort=amount` is in the query. Out of scope here; tracked for its own fix and PR.
- The dialog has no automated test because the repo has no DOM test runner. Manual steps are listed in the plan and recorded in the PR.

## Out of scope

- Fixing the amount sort comparator in `src/data/queries.ts` (separate defect, own branch and PR).
- The metrics defects behind NWP-102 (`src/data/metrics.ts`).
- Human-readable CSV headers, remembering the last column set, or any persistence (NWP-203).
- Making `src/app/payments/page.tsx` call `parseFilters` instead of its own status check.

## Open questions

- Filename token when the current filter has no status but has a merchant or search: this spec uses `filtered`. If ops would rather see the merchant id, that is a one-line change in `exportScopeToken`.
- Whether an invalid `scope` should 400 or fall back to `current`, matching how `parseFilters` defaults. This spec rejects, per the api-routes rule.
