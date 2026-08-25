# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Kevin Yan
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and every file comes out identical: every column, current filter only, no say in it. The card last-four is in all of them, so anything going to a merchant gets cleaned up by hand first. That is 3–4 hours a month of spreadsheet editing, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

- `src/app/api/payments/export/route.ts:11` — the export is already a server route. It calls `parseFilters`, `filterPayments`, `sortPayments`, then `toCsv(rows)` with no column argument and `exportFilename()` with no arguments. Its own doc comment (lines 5–10) names NWP-101 as the ticket that makes column set and scope selectable.
- `src/lib/csv.ts:58-67` — **`toCsv` already accepts a `columns` argument.** The plumbing for column selection exists and is tested (`src/lib/csv.test.ts:32-36`); nothing in the app passes it. This change is smaller than the ticket implies.
- `src/lib/csv.ts:13-24` — `EXPORT_COLUMNS` is the full ten-column list and doubles as the natural server-side allowlist. `last4` is entry 8.
- `src/lib/csv.ts:69-71` — `exportFilename(date)` stamps the UTC day only: `payments-2026-03-14.csv`. No scope token.
- `src/lib/csv.ts:52` — the `amount` cell already calls `formatMoney(payment.amount, payment.currency)`, and `currency` is already its own column. AC4 is satisfied today.
- `src/data/queries.ts:18-36` — `parseFilters` is the allowlist boundary for `status`, `sort`, and `direction`. It knows nothing about columns or scope; that is where the new validation belongs, or beside it.
- `src/data/queries.ts:45,72,102` — `filterPayments` / `sortPayments` / `queryPayments`, the one query builder. `queryPayments` returns `{ rows, total, page, pageCount, pageSize }`.
- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?…">` inside a `Button asChild`. The page is a server component and already holds `total` for the current filter (line 45), so the current-filter row count needs no new fetch.
- `src/app/payments/filter-bar.tsx:1-42` — the existing `"use client"` + `useRouter` pattern to copy for an interactive control on this page.
- `src/components/Drawer.tsx:3,185` — the only wrapper over `@radix-ui/react-dialog`, exporting `Drawer`, `DrawerContent`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`, `DrawerClose`.

**Where the ticket and the docs do not match the code:**

- `merchant-console/.claude/rules/components.md` says `src/components/` "already has Button, Input, Select, **Dialog**". There is no `Dialog.tsx`. `Drawer.tsx` is the Radix dialog wrapper, and it is what this ticket should reuse.
- There is **no Checkbox primitive**. `src/components/Input.tsx:77` only branches on password; a column picker needs one built.
- The ticket warns "building this in the browser exports the current page only". The export is already server-side and calls `filterPayments` directly, bypassing `paginate`, so it is not paginated today. The trap only opens if the dialog is tempted to serialise rows it already has on screen.
- `src/data/queries.ts:79-81` — sorting by amount compares `String(a.amount).localeCompare(...)`, so `$99.00` sorts above `$1,000.00`, and the comment above it claims the opposite. Real defect, affects export row order when `sort=amount`, **not this ticket**.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units. `$250.00` is `25000`. No floats, no strings with currency symbols. Format once, at the edge, next to its currency code." | `merchant-console/CLAUDE.md` | Cents drift; a formatted string re-enters arithmetic |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone. Nothing else does." | `merchant-console/CLAUDE.md` | The filename date disagrees with the rows in the file |
| "One query builder. Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut." | `merchant-console/CLAUDE.md` | Export and table silently disagree about what matches a filter |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store." | `merchant-console/CLAUDE.md` | Client-supplied column names reach a header row or a filename |
| "Column names arrive from the client, so validate them server-side. Do not interpolate them into SQL." | ticket, Notes from the team | The named injection vector |
| "Dialogs and forms must be operable. Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it." | `.claude/rules/components.md` | Ops cannot drive the picker from the keyboard |
| "Card last-four is **off** by default." | ticket, AC1 | The near-miss happens again |

## Approach

Extend the path that exists rather than build beside it. `toCsv` already takes a column list, so the work is a validated way to choose one and a dialog to choose it in. The route grows two client inputs — `columns` and `scope` — and validates both server-side: column names are filtered against `EXPORT_COLUMNS` in `src/lib/csv.ts` and anything unrecognised is dropped, and `scope` is a two-value allowlist where `all` means calling the same `filterPayments` with empty filters rather than a second code path. `toCsv`'s own default stays `EXPORT_COLUMNS` so existing tests hold; the *route's* default when no `columns` param arrives becomes the same list minus `last4`, which is where AC1 is actually enforced — a bare URL cannot leak card data. `exportFilename` takes a scope token, derived server-side from filters that have already been through the allowlist so nothing client-shaped reaches a filename. The dialog is a `Drawer` on the payments page; both row counts are computed in the server component and passed as props, so no new endpoint and no fetch on open.

**Considered and rejected:** building the CSV in the browser from rows already rendered. `PAGE_SIZE` is 20 (`src/data/queries.ts:43`), so it would export one page and call it an export — the exact bug the ticket names. Also rejected: a `/api/payments/export/count` endpoint for the row counts. `queryPayments` already returns `total`, and the page is a server component, so counting on the server and passing two numbers down is free.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add `DEFAULT_EXPORT_COLUMNS` (all but `last4`), a column allowlist parser, and a scope token argument on `exportFilename` |
| `src/lib/csv.test.ts` | change | Extend, per the DoD — allowlist rejection, last4-off default, filename scope tokens |
| `src/app/api/payments/export/route.ts` | change | Read and validate `columns` and `scope`; empty filters for `all`; pass the token to `exportFilename` |
| `src/app/payments/export-dialog.tsx` | add | `"use client"` Drawer: column checkboxes, scope radios, live row count, Download disabled at zero columns |
| `src/app/payments/page.tsx` | change | Replace the `<a>` at lines 68–76 with the dialog; pass current-filter total, all-payments total, and the current query string |
| `src/components/Checkbox.tsx` | add | No checkbox primitive exists; the column picker needs a labelled, keyboard-operable one |

## Plan

1. **Column allowlist and default set in `src/lib/csv.ts`** — done when: a parser turns a comma-separated client string into a validated `ExportColumn[]`, unknown names are dropped rather than passed through, and `DEFAULT_EXPORT_COLUMNS` excludes `last4` while `toCsv`'s own default still returns all ten.
2. **Scope token on `exportFilename`** — done when: `disputed` → `payments-disputed-2026-08-13.csv`, other filters with no status → `payments-filtered-…`, no filters or all-payments scope → `payments-all-…`, and the existing `exportFilename` test at `csv.test.ts:80-84` still passes.
3. **Extend `src/lib/csv.test.ts`** — done when: `npm test` passes with new cases covering steps 1 and 2, and none of the eight existing `toCsv` cases changed.
4. **Wire the route** — done when: `curl "/api/payments/export?columns=id,amount&status=disputed"` returns two columns of disputed rows, `?columns=id,password` returns only `id`, a bare `/api/payments/export` has no `last4` column, and `?scope=all&status=disputed` returns every payment.
5. **Checkbox primitive** — done when: it renders with a visible label, is reachable and togglable by keyboard, and follows the Tailwind-only rule.
6. **Export dialog** — done when: it opens from the payments page, defaults to current filter with last4 unchecked, shows the row count for the selected scope, disables Download at zero columns, closes on Escape, and returns focus to the trigger.
7. **Page wiring** — done when: the old `<a>` is gone, both counts come from the server component, and a real download lands with the chosen columns and filename.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Unit test: the route's default column set excludes `last4`. Click-through: open the dialog, last4 is unchecked, downloaded file has no last4 column |
| Scope current-filter or all; current is default; count visible before download | Click-through on `/payments?status=disputed`: dialog opens on "current filter" showing the disputed count, switching to "all payments" shows the full store count (~1,680 rows) |
| Filename reflects scope and date | Unit test in `csv.test.ts` for all three tokens against a fixed UTC date; confirmed by the `content-disposition` header on a real download |
| Amounts in minor units, formatted once, currency its own column | Already true — `src/lib/csv.ts:52` and the `currency` column. Held by the untouched `csv.test.ts:32-41` cases |
| Zero columns disables Download | Click-through: uncheck every column, Download is `disabled`; no request is made and no empty file is written |
| Query builder reused | Read the diff: the route still calls `filterPayments`/`sortPayments` and `scope=all` passes empty filters to the same function. `/ship-ready` check 3 reports no second filter path |
| `npm test` passes | Paste the summary line into the PR, per Release Standards in the root `CLAUDE.md` |

## Risks

- **Column defaults are the safety control.** The last4 protection has to live in the route's default set, not in the dialog's initial checkbox state — a bookmarked bare URL must not leak card data. Test the route default directly, not through the UI.
- **Changing `toCsv`'s own default would break three existing tests** (`csv.test.ts:27-30` pins the full header). Add a separate route-level default instead of moving the library one.
- **Scope token derived from raw params could put client text in a filename.** Derive it only from values `parseFilters` has already allowlisted, never from `search` or a merchant name.
- **`scope=all` serialises the whole store** — 120 days × ~14/day ≈ 1,680 rows (`src/data/generate.ts:17-18`). Fine in memory today; it would need streaming against a real database, which is NWP-203's problem.
- **Amount sorting is already wrong** (`src/data/queries.ts:79-81`), so an amount-sorted export inherits the wrong row order. Not caused by this change, not fixed by it — logged, and it smells like part of NWP-102.

## Out of scope

- Fixing the lexicographic amount sort in `src/data/queries.ts:79-81` — flag it on the PR; it belongs with NWP-102's data-integrity work.
- Saved or per-user column presets. Ops asked to choose per export, not to store a profile.
- Export formats other than CSV, scheduled or emailed exports, and column reordering — selection order in the dialog follows `EXPORT_COLUMNS`.
- Persistence of any kind. `merchant-console/CLAUDE.md`: "Do not add a database, an ORM, or migrations."

## Open questions

- Should the dialog surface *which* filters are active in words ("Disputed, Lumen Coffee Roasters"), or is the row count enough for Dana's team to trust what they are about to download?
- If a saved bookmark carries `columns=` naming a column that is later removed from `EXPORT_COLUMNS`, dropping it silently is the plan. Would ops rather see an error than a file quietly missing a column?
