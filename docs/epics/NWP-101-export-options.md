# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Henry Hirshland
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and the export is fixed: every column, current filter only. The card last-four is in every file, so anything going to a merchant is cleaned up by hand first. That is 3–4 hours a month of spreadsheet editing, and a near-miss last quarter where an unedited file nearly went to the wrong merchant.

## Current state

- `src/lib/csv.ts` — `toCsv(payments, columns = EXPORT_COLUMNS)` **already accepts a column subset**. The plumbing exists; nothing ever calls it with one. `escapeCell` handles commas, quotes, and newlines; `cell()` is an exhaustive switch over the ten columns in `EXPORT_COLUMNS`.
- `src/lib/csv.ts` — `exportFilename(date = new Date())` returns `payments-YYYY-MM-DD.csv`. No scope segment.
- `src/app/api/payments/export/route.ts` — composes `parseFilters` → `filterPayments` → `sortPayments`, with **no pagination**. The current-filter export already covers every matching row, not just the visible page. It calls `toCsv(rows)` and `exportFilename()` with no arguments, which is the whole of the defect.
- `src/data/queries.ts` — `parseFilters` is the server-side allowlist for status, sort, direction, and page. `filterPayments` / `sortPayments` / `paginate` / `queryPayments` are the one query path.
- `src/app/payments/page.tsx:36` — the page builds `PaymentFilters` inline against its own local `STATUSES` array instead of calling `parseFilters`. That is a **second allowlist for the same parameters**, and the dialog's row counts must not become a third.
- `src/app/payments/page.tsx:69` — the Export button is a plain `<a href="/api/payments/export?…">`. No dialog, no options.
- `src/app/payments/filter-bar.tsx` — the existing `"use client"` interactive leaf. The dialog matches this shape: client component, pushes a URL, server does the work.
- `src/lib/csv.test.ts` — nine tests pinning escaping and the column contract. Its header comment states NWP-101 "changes which columns ship, not how a cell is written, and these should still pass afterwards."

**Where the ticket does not match the code:**

- The note "Do not interpolate them into SQL" describes a risk that cannot occur — there is no SQL and no database, only the in-memory store in `src/data/store.ts`. The live version of that risk is an unvalidated column name reaching the **CSV header or the filename**, which `docs/ORG-STANDARDS.md` #7 names explicitly.
- The note "the payments table is paginated, building this in the browser exports the current page only" is a warning about an approach, not a bug to fix. The server route already exports the full filtered set.
- `.claude/rules/components.md` claims `src/components/` "already has Button, Input, Select, Dialog, Badge." **There is no `Dialog.tsx` and no checkbox primitive.** `@radix-ui/react-dialog` is installed (`Drawer.tsx` wraps it), so a dialog is buildable with no new dependency; checkboxes will be native inputs styled with Tailwind.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units… Format once, at the edge" | `ORG-STANDARDS.md` #1–2, `merchant-console/CLAUDE.md` | Cents drift; a formatted string re-enters arithmetic |
| "One query builder. Filtering and sorting go through the shared builder. A second implementation of the same lookup is a defect" | `ORG-STANDARDS.md` #6 | Export and table disagree about what "disputed" means |
| "Anything from a client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, **a filename**, or the store. Client-side checks are UX, never enforcement" | `ORG-STANDARDS.md` #7 | A crafted `columns=` or `scope=` reaches the header row or the `content-disposition` filename |
| "Card numbers are masked everywhere" | `ORG-STANDARDS.md` #8 | The reason this ticket exists — `last4` must default **off** |
| "Store and bucket in UTC" | `ORG-STANDARDS.md` #4 | The filename date disagrees with the rows in the file |
| "Dialogs and forms must be operable… focus moves into it and returns on close, Escape closes it" | `.claude/rules/components.md` | Keyboard-only ops staff cannot export |

**Decided:** the amount cell stays `formatMoney(…)` → `$250.00`, with `currency` remaining its own column. Every clause of AC 4 is already satisfied by `src/lib/csv.ts`, and the pinned assertions in `src/lib/csv.test.ts` stay green.

## Approach

The export stays entirely server-side. Widen `GET /api/payments/export` to accept two more client parameters — `columns` (comma-separated) and `scope` (`filter` | `all`) — validated by a new `parseExportOptions` that sits beside `parseFilters` in `src/data/queries.ts`, so there is still one place where client input is allowlisted. `columns` is intersected with `EXPORT_COLUMNS` and order is taken from the allowlist, not from the client; an empty or fully-invalid list is a 400, not an empty file. `scope=all` runs the same `filterPayments` with an empty filter set rather than reading `store.payments` directly, so both scopes share the one query path. `exportFilename` grows a scope segment. On the client, the Export button becomes a dialog of column checkboxes plus a scope radio pair, which composes the URL and navigates to it — the browser never sees a row.

Row counts come from `src/app/payments/page.tsx`, which is a server component and already computes the filtered `total`; it computes the unfiltered total the same way and passes both into the dialog as props. While there, route the page's filter parsing through `parseFilters` so the page stops carrying its own duplicate `STATUSES` allowlist.

**Considered and rejected:** building the CSV in the browser from the rows already on screen. It exports one page of twenty — the exact bug the ticket names — and it duplicates the escaping logic that `src/lib/csv.ts` already owns, which is `ORG-STANDARDS.md` #6. **Also rejected:** a `GET /api/payments/count` route for the row counts. `CLAUDE.md` is explicit — "Do not add a route handler when a server component can read the store itself."

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/queries.ts` | change | Add `parseExportOptions` beside `parseFilters` — the one server-side allowlist for `columns` and `scope` |
| `src/lib/csv.ts` | change | `exportFilename` takes a scope segment; add `DEFAULT_EXPORT_COLUMNS` (all but `last4`) |
| `src/lib/csv.test.ts` | change | Extend, per the DoD — column selection, the `last4` default, filename segments, empty-selection rejection |
| `src/app/api/payments/export/route.ts` | change | Read validated options, pick the filter set by scope, pass columns to `toCsv`, 400 on an empty column set |
| `src/components/Dialog.tsx` | add | No dialog primitive exists; build on the installed `@radix-ui/react-dialog`, matching `Drawer.tsx` |
| `src/app/payments/export-dialog.tsx` | add | `"use client"` leaf holding checkboxes, scope, live count, and the disabled Download rule |
| `src/app/payments/page.tsx` | change | Swap the inline filter parsing for `parseFilters`, compute both totals, render the dialog in place of the `<a>` |

## Plan

1. **`parseExportOptions` in `src/data/queries.ts`** — done when: an unknown column name, an empty `columns`, and `scope=../../etc` each come back as a safe, allowlisted value or an explicit rejection, proven by tests.
2. **Column defaults and filename segment in `src/lib/csv.ts`** — done when: `DEFAULT_EXPORT_COLUMNS` excludes `last4`, and `exportFilename` produces `payments-disputed-2026-08-13.csv` for the ticket's example. The nine existing tests still pass untouched.
3. **Extend `src/lib/csv.test.ts`** — done when: `npm test` is green and covers the serializer against the column allowlist, per the DoD.
4. **Wire `src/app/api/payments/export/route.ts`** — done when: hand-built URLs prove it. `?columns=id,amount` returns two columns; `?scope=all` ignores an active `status`; `?columns=` returns 400; `?columns=id,DROP` returns only `id`.
5. **Build `src/components/Dialog.tsx`** — done when: it opens, Escape closes it, focus enters and returns to the Export button, and it has an accessible name.
6. **Build `src/app/payments/export-dialog.tsx` and mount it in `page.tsx`** — done when: `last4` is unticked on open, the count updates as scope changes, Download is disabled with nothing ticked, and clicking it downloads a file matching the ticked boxes.
7. **`npm run build`, `npm run lint`, `npm test`, then `/ship-ready`** — done when: all four are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four **off** by default | New cases in `src/lib/csv.test.ts` for `DEFAULT_EXPORT_COLUMNS`; opening the dialog and reading the unticked `last4` box |
| Scope: current filter or all; filter is default; count visible first | Filter to `disputed`, open the dialog, confirm the filtered count matches the table footer and that switching to "All payments" shows the larger total |
| Filename reflects scope and date | `exportFilename` cases asserting `payments-disputed-2026-08-13.csv` and `payments-all-….csv`; confirmed in the browser's download bar |
| Amounts in minor units, formatted once, currency its own column | The existing `toCsv` assertions in `src/lib/csv.test.ts` stay green unmodified; `Payment.amount` is untouched end to end |
| Deselecting every column disables Download | Untick all in the dialog and confirm the button is disabled; separately, `GET …/export?columns=` returns 400 rather than a file |
| Server-side validation of column names | `parseExportOptions` test feeding unknown and malicious column names; `?columns=id,DROP` returns only the `id` column |
| Reuses the query builder | Read the diff: `src/app/api/payments/export/route.ts` still calls only `filterPayments` / `sortPayments`, and no new filter loop exists |

## Risks

- **`sortPayments` sorts amounts as strings.** `src/data/queries.ts:81` compares `String(a.amount).localeCompare(…)`, so `$90.00` sorts above `$100.00`. An amount-sorted export inherits it. Do not fix it here — see Out of scope — but do not let it be mistaken for a bug this ticket introduced.
- **Filename injection.** The scope segment must be derived from the validated `scope`/`status`, never interpolated from a raw parameter into `content-disposition`. `ORG-STANDARDS.md` #7 names filenames specifically.
- **No dialog primitive exists** despite `.claude/rules/components.md` saying otherwise. Step 5 is real work, not a wiring step, and the accessibility bullets in that rule are the acceptance bar.
- **`scope=all` must still go through `filterPayments`.** Reading `store.payments` directly would be the second query path that `ORG-STANDARDS.md` #6 forbids.
- **Large all-scope export** builds the whole CSV in memory. Acceptable at seed-data size; noted, not solved.

## Out of scope

- The `sortPayments` amount-sorting defect — that is NWP-102, the investigation ticket this one is linked to.
- Exposing the `from` / `to` date filters, which `parseFilters` supports but no UI sets.
- Saved or named export presets. Dana asked to choose columns per export, not to store a choice.
- Persistence of any kind — NWP-203.

## Open questions

- **Filename segment when the filter is not a status.** The ticket only shows `payments-disputed-….csv`. Assumption for now: `all` for scope=all, the status when one is set, and `filtered` when scope=filter with a merchant or search but no status. Worth confirming with Dana — a merchant-name segment may be more useful to her team than the word `filtered`.
- **Which date stamps the filename.** `exportFilename` defaults to `new Date()`, i.e. the real day the file was pulled, which is what "the date" most likely means to ops. The repo's `GENERATED_AT` anchor governs seed data, not this. Passing the date in explicitly at the route boundary keeps it testable either way.
