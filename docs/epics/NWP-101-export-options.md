# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Hoseong Liam Hwang
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and the export is fixed: every column, current filter only. The card last-four is in every file, so anything going to a merchant is cleaned up by hand first: 3–4 hours a month, plus a near-miss last quarter where an unedited file nearly went to the wrong merchant. The fix is an options dialog on the existing Export button on `/payments`.

## Current state

- `src/app/api/payments/export/route.ts` — the export route. It already reuses the query builder (`parseFilters` → `filterPayments` → `sortPayments`) and already exports the **whole filtered result, not the current page**. Only the column set and the scope are hard-coded (its own comment at line 8 says so).
- `src/lib/csv.ts:13` — `EXPORT_COLUMNS` is already the allowlist, and `toCsv(payments, columns)` at line 58 already takes a column list and emits them in the order given. **The serializer does not need rewriting; it needs a validated caller.**
- `src/lib/csv.ts:69` — `exportFilename(date)` stamps the UTC date only. No scope segment.
- `src/lib/csv.ts:52` — the `amount` cell renders through `formatMoney`, and `currency` is already its own column (line 23).
- `src/data/queries.ts:18` — `parseFilters` is where client input is checked against an allowlist. `filterPayments` (line 45) returns every match; `paginate` (line 87) is what makes the table paginated, and the export never calls it.
- `src/app/payments/page.tsx:68` — the Export button is a plain `<a href="/api/payments/export?…">` inside a server component. Line 45 already computes `total` for the current filter.
- `src/app/payments/filter-bar.tsx` — the existing pattern for an interactive island on this page: `"use client"`, props in from the server page, `router.push` out.
- **Ticket vs. code:** the note "Building this in the browser exports the current page only" describes a trap to avoid, not a bug that exists today — the route is already whole-result. Keep it that way.
- **Docs vs. code:** `.claude/rules/components.md` says `src/components/` has a `Dialog`. It does not. The Radix-dialog primitive here is `src/components/Drawer.tsx` (focus trap, Escape, `DrawerTitle`/`DrawerDescription`/`DrawerFooter`/`DrawerClose`). There is no `Checkbox` component either; `src/components/DropdownMenu.tsx:191` has `DropdownMenuCheckboxItem` and `DropdownMenuRadioItem` (line 389).
- **Pre-existing defect, not ours:** `sortPayments` (`src/data/queries.ts:81`) compares amounts as strings — `String(a.amount).localeCompare(...)` — so an amount-sorted export comes out lexicographic. See Out of scope.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` | Cents drift; two formatters disagree |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` §4, `.claude/rules/api-routes.md` | Header injection, a poisoned filename, an unbounded query |
| "One query builder. Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut." | `merchant-console/CLAUDE.md` §3 | Export and table disagree about what "disputed" means |
| "Return the same error shape everywhere: a status code that means what it says, and a body with a message safe to show a user." | `.claude/rules/api-routes.md` | Ops sees a stack trace |
| "Dialogs and forms must be operable… focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Keyboard-only ops staff cannot export |
| "Never return a full card number." Last four is opt-in here, off by default. | `CLAUDE.md` cards, ticket AC 1 | The exact leak this ticket exists to close |
| "A unit test covers the column serializer, and `npm test` passes… extend `src/lib/csv.ts`'s test file." | Ticket, Definition of done | DoD not met |

## Approach

Keep every decision on the server. The Export button becomes a client island that opens a `Drawer` with a column checklist (last4 unchecked by default), a scope radio (current filter / all payments), and a live row count; it does not read or serialize any payment data — it only builds a query string and navigates to `GET /api/payments/export?columns=…&scope=…`. The route parses `columns` and `scope` through a new allowlist parser that lives beside `EXPORT_COLUMNS` in `src/lib/csv.ts` (so `csv.test.ts` can cover it without Next), then feeds the existing query builder: `scope=filter` keeps `parseFilters(searchParams)`, `scope=all` runs the same builder with no filters. Row counts come from the server page as props — `page.tsx` already computes the filtered `total`, and one more `queryPayments` call gives the unfiltered one — so the dialog fetches nothing. Filename gains a scope segment derived from the *validated* filters, never from a raw param.

**Considered and rejected:** building the CSV in the browser from the rows already on the page. It is the fastest path and it is the bug the ticket names — the table is paginated (`src/data/queries.ts:87`), so it would export 20 rows and call it a month-end reconciliation. Also rejected: a second `/api/payments/export/columns` endpoint to serve counts, when the page already has them.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add the server-side column/scope parser next to `EXPORT_COLUMNS`; add an optional scope segment to `exportFilename`. `toCsv` is untouched. |
| `src/lib/csv.test.ts` | change | Extend with parser cases (unknown/duplicate/empty columns) and scoped-filename cases. DoD names this file. |
| `src/app/api/payments/export/route.ts` | change | Validate `columns` + `scope`, pick the filter set, pass columns to `toCsv`, set the scoped filename, 400 on no valid columns. |
| `src/app/payments/export-dialog.tsx` | add | The client island: Drawer, column checkboxes, scope radio, row count, Download disabled when nothing is selected. |
| `src/app/payments/page.tsx` | change | Swap the `<a>` Export button for the island; pass the current query string and both row counts. |

## Plan

1. **Parser in `src/lib/csv.ts`** — done when: an unknown column name, a duplicate, and an empty list each return a predictable result, proven by new cases in `csv.test.ts`; `npm test` green.
2. **Scope segment on `exportFilename`** — done when: `payments-disputed-2026-08-13.csv` and `payments-all-2026-08-13.csv` are asserted, and the existing no-scope assertion at `csv.test.ts:81` still passes untouched.
3. **Wire the route** — done when: `curl -i '/api/payments/export?status=disputed&columns=id,amount,currency'` returns only those columns with that filename; `&scope=all` returns every payment; `&columns=id,DROP` ignores the junk; `&columns=` returns 400 with a user-safe message.
4. **Build the dialog island** — done when: it opens from the Export button, last4 is unchecked on open, the count matches the table's footer, Escape closes it and focus returns to the button.
5. **Swap the button in `page.tsx` and walk it** — done when: an ops-style run (filter to disputed → uncheck nothing → Download) produces the right file, and `npm test` plus `/ship-ready` are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns are selectable; last4 off by default | Dialog opened on `/payments`, last4 unchecked on open; downloaded file has no `last4` header. Parser unit test in `csv.test.ts` covers the server side. |
| Scope current-filter (default) or all, count visible first | Dialog shows the filtered count matching the footer at `page.tsx:142`; switching to "all payments" shows the store total; each scope's file row count matches. |
| Filename reflects scope and date | New `exportFilename` cases in `csv.test.ts`; `content-disposition` checked with `curl -i`. |
| Amounts in minor units, formatted once, currency in its own column | Existing `csv.test.ts` cases at lines 33 and 40 still pass unchanged; no new formatter added — `grep` for `toFixed`/`/100` outside `src/lib/money.ts` returns nothing new. |
| Deselecting every column disables Download | Dialog: Download disabled with zero columns. Server: `columns=` returns 400, not an empty file — asserted by a parser unit test. |

## Risks

- **The browser-export trap.** If the dialog is ever handed `rows`, it will export one page. Mitigation: the island takes counts and a query string, never payment objects.
- **Column names reach a filename and a header row.** Both must come from the validated list, never from `searchParams` directly.
- **Counts are rendered server-side at page load** and the store is in-memory and mutable (`src/data/store.ts`), so a count can go stale if data changes before Download. Acceptable for this console; do not paper over it with a client fetch.
- **`sortPayments` amount ordering is already wrong** (`src/data/queries.ts:81`). An amount-sorted export inherits it. Do not fix it inside this diff — it changes the table too.

## Out of scope

- Fixing the string-compare amount sort in `src/data/queries.ts:81` — separate ticket, it changes `/payments` as well.
- Saved column presets, XLSX, scheduled exports, and anything in NWP-102.
- Persistence of any kind — that is NWP-203, and `CLAUDE.md` forbids a database here.
- New pagination behaviour on `/payments`.

## Open questions

- Filename when scope is "current filter" but no status is set (merchant or search only): plan assumes it falls back to today's `payments-<date>.csv`, which keeps `csv.test.ts:81` honest. Confirm that reads right to Dana.
- "All payments" is assumed to ignore *every* filter, including a date range — not just the status. Confirm before step 3.
