# SPEC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Moaaz Elsayed
**Status:** building

## Problem

Ops exports the payments table several times a day, but the export is fixed: every column, current filter only. The card last-four lands in every file, so anything sent to a merchant is hand-scrubbed first — roughly 3–4 hours a month, plus a near-miss last quarter where an unedited file nearly went to the wrong merchant. Dana's team wants to pick the columns and the scope before the file is generated, not after.

## Current state

All paths relative to `build-battle/merchant-console/`.

- `src/lib/csv.ts` — `EXPORT_COLUMNS` (10-column const tuple, includes `last4`); `toCsv(payments, columns = EXPORT_COLUMNS)` **already accepts an ordered subset**; private `cell()`/`escapeCell()` do the RFC4180 work; `exportFilename(date)` → `payments-YYYY-MM-DD.csv` in UTC. No runtime validation exists — `ExportColumn` is compile-time only.
- `src/app/api/payments/export/route.ts` — `GET` → `parseFilters` → `sortPayments(filterPayments(...))` → `toCsv(rows)` → `Response` with a `content-disposition` filename. Reads no `columns`/`scope` params and has no 400 path.
- `src/app/payments/page.tsx` — async **server** component. Export is `<Button asChild><a href={"/api/payments/export?" + query}>`. It already computes `total`, the full filtered count, via `queryPayments(filters)`.
- `src/data/queries.ts` — the one query builder: `parseFilters` (allowlist + silent-coerce), `filterPayments`, `sortPayments`, `paginate`, `queryPayments`.
- `src/lib/csv.test.ts` — pins the header, the ordered subset, escaping, merchant fallback, null-card cells, zero rows, and the UTC filename. Extend this file per the DoD.
- `src/components/` — there is **no** Dialog.tsx and **no** checkbox primitive. `Drawer.tsx` is built on `@radix-ui/react-dialog` and gives focus trap/return and Escape for free.
- **Does not match the ticket:** the note about the paginated table says building this in the browser would export the current page only. The route already exports the full filtered set — that bug does not exist today, and the job is not to introduce it.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md`, `.claude/rules/money.md` | Cents drift; a second formatter makes the CSV and the table disagree |
| Validate everything from the client against an allowlist before it reaches a query **or a filename** | `.claude/rules/api-routes.md` | Client-supplied column names reach a header row or a `content-disposition` |
| Reuse the one query builder behind `GET /api/payments` | `.claude/rules/api-routes.md` | A second filter path drifts from the table it claims to export |
| Return the same error shape everywhere: a status that means what it says, a body safe to show a user | `.claude/rules/api-routes.md` | Callers cannot tell a bad request from a broken server |
| Use what is here; every input labeled, dialog has an accessible name, focus returns, Escape closes | `.claude/rules/components.md` | A new dependency for a checkbox, or a dialog ops cannot operate by keyboard |
| Bucket and compare in UTC | `.claude/rules/api-routes.md` | Two exports on the same day get different filenames by timezone |

## Approach

Push the whole feature through the existing seams. `toCsv` already takes an ordered column subset, so the server work is a **parser plus a validator**, not a new serializer: `parseExportColumns(param)` in `src/lib/csv.ts` resolves the `columns` param against the `EXPORT_COLUMNS` allowlist and returns `null` for anything it cannot honor. The route maps `null` → 400 and otherwise passes the resolved list to `toCsv`. `scope` is silent-coerced like every other filter, and `scope=all` reuses the same builder with an empty filter set rather than reaching into the store. On the client, one new `"use client"` component wraps the existing Export button in a `Drawer`, using native labeled checkboxes and radios; the server page hands it the two row counts it already has (or can get from the builder), so the dialog fetches nothing.

**Considered and rejected:**
- *Silent-coercing bad column names to the default set* (the `parseFilters` idiom). Rejected: shipping a file with different columns than were asked for is exactly the failure mode the ticket describes. A wrong column list means a broken client, so it gets a 400.
- *Adding `@radix-ui/react-checkbox`* for the column picker. Rejected: components.md says use what is here, and a native `<input type="checkbox">` with a `<label>` is more accessible than a hand-wired custom control.
- *A new `/api/payments/count` endpoint* for the "all payments" row count. Rejected: the page is already a server component with the builder in scope; a client fetch would add a loading state for a number we already have.
- *Building the column subset in the browser* from the rendered table. Rejected: that exports the current page only — the bug the ticket warns about.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Add `DEFAULT_EXPORT_COLUMNS` + `parseExportColumns()`; extend `exportFilename(date, scope?)` | One allowlist, one default set, one filename builder |
| `src/app/api/payments/export/route.ts` | Read/validate `columns` + `scope`; 400 on invalid columns; scope=all path; scope-aware filename | Server-side enforcement per api-routes.md |
| `src/lib/csv.test.ts` | Extend with column-selection and filename cases | DoD: a unit test covers the column serializer |
| `src/app/payments/export-dialog.tsx` | **New** client component: Drawer, checkboxes, scope radios, live count, Download | The dialog the ticket asks for |
| `src/app/payments/page.tsx` | Swap the bare Export anchor for `<ExportDialog …>`; compute `allTotal` | Wire it in |

## Plan

Sequenced so each step ends somewhere verifiable. Route and validation land before the dialog, so the server is correct before anything can call it.

1. **Spec + baseline** — write this document; run `npm test`. *Done when: suite green, summary captured.*
2. **`src/lib/csv.ts`** — `DEFAULT_EXPORT_COLUMNS` (= `EXPORT_COLUMNS` minus `last4`), `parseExportColumns`, `exportFilename(date, scope?)`. Date stays the first parameter so the pinned UTC test passes untouched. *Done when: `npx vitest run src/lib/csv.test.ts` still green with no existing test edited.*
3. **Export route** — read both params, 400 on an unusable column list, scope handling, derived filename label, `toCsv(rows, columns)`. *Done when: `curl -i` shows the subset header row, no `last4` by default, a 400 with a JSON error for `columns=bogus` and `columns=`, and `disputed`/`all`/`filtered` filename labels.*
4. **Tests** — extend `src/lib/csv.test.ts`: ordered subset; default excludes `last4` and keeps `amount` + `currency`; `""` → `null`; unknown name → `null`; case mismatch `"ID"` → `null`; empty segment `"id,,amount"` → `null`; duplicates deduped, first occurrence wins; `exportFilename(date, "disputed")` → `payments-disputed-2026-08-13.csv`; no-scope call unchanged. *Done when: the file passes.*
5. **`export-dialog.tsx`** — `DrawerTrigger asChild` on the existing Export button; a `<fieldset><legend>Columns</legend>` checkbox list initialized to `DEFAULT_EXPORT_COLUMNS`; a `<fieldset><legend>Scope</legend>` radio pair; a count line that switches with the scope; href built with `URLSearchParams`; Download disabled at zero columns. *Done when: it compiles and wires in step 6.*
6. **`page.tsx`** — pass `query.toString()`, `total`, and `allTotal` in. *Done when: the dialog opens on `/payments` and downloads the file it describes.*
7. **Full verification** — `npm test` and a pass over the acceptance criteria on the running dev server.

## Decisions

1. **The safe default lives in one place.** `DEFAULT_EXPORT_COLUMNS = EXPORT_COLUMNS` minus `last4`. `toCsv`'s own signature and default are untouched so the existing tests keep passing, but `parseExportColumns(null)` returns the safe default — the server excludes last-four even when the request never went through the dialog. The near-miss in the ticket is the reason that has to hold on the server, not just in the UI.
2. **`parseExportColumns(param: string | null): readonly ExportColumn[] | null`.** Comma-separated; every name must be in `EXPORT_COLUMNS`; strict (case-sensitive, no whitespace tolerance); order preserved; duplicates deduped with first occurrence winning; empty string, empty result, or any unknown name → `null` → 400.
3. **`scope=filter|all`, silent-coerced to `"filter"`** — matching the `parseFilters` idiom, and a bad scope falls back to the *smaller* export. `scope=all` calls `parseFilters(new URLSearchParams())` for an empty filter set while keeping `sort`/`direction` from the request, so there is still exactly one filter path.
4. **Filename `payments-[label-]YYYY-MM-DD.csv`.** The label derives only from allowlisted values: `"all"` for `scope=all`, else the coerced status when it is not `"all"`, else `"filtered"`. Raw client input never reaches the filename.
5. **Error shape `NextResponse.json({ error: "…" }, { status: 400 })`.** No API error exists in the codebase yet; this sets the canonical shape.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Unit test: `parseExportColumns(null)` excludes `last4`; curl: default export header row has no `last4`; dialog opens with the box unchecked |
| Scope choice, current filter default, row count visible before download | Dialog radios default to "current filter"; the count line shows filtered vs. all and switches live; curl `scope=all` returns more rows than the filtered call |
| Filename reflects scope and date | Unit tests on `exportFilename`; curl `content-disposition` shows `payments-disputed-…`, `payments-all-…`, `payments-filtered-…` |
| Amounts stay minor units, formatted once, currency in its own column | Unchanged `toCsv`/`cell` path — `formatMoney` is called only at the CSV edge; the default column set keeps `currency` |
| Deselecting every column disables Download rather than producing an empty file | Zero boxes → a real `disabled` button (no href); server backstop: `columns=` → 400 with an error body, no file |
| DoD: a unit test covers the column serializer and `npm test` passes | Step 4 lands in `src/lib/csv.test.ts`; the before and after summaries are recorded in the PR |

## Risks

- **A 400 is a harder failure than the rest of the codebase uses.** Everything else silently coerces. Mitigated by scoping the 400 to the one param where a silent fallback would ship the wrong data, and by the dialog only ever sending allowlisted names — a 400 means a hand-built URL or a bug, both of which should be loud.
- **The dialog and the server could disagree about the default column set.** Mitigated by both importing `DEFAULT_EXPORT_COLUMNS` from `src/lib/csv.ts`.
- **`allTotal` costs a second unfiltered pass over the store on every page render.** In-memory and small; acceptable rather than adding a cache or an endpoint.

## Out of scope

- The pre-existing lexicographic amount sort in `sortPayments` (`String(a.amount).localeCompare(...)`), which mis-orders `sort=amount` exports. Noted in the PR, not fixed here — it is a defect of its own and changing sort order mid-ticket would muddy the diff.
- Remembering a column selection between sessions. Persistence is NWP-203.
- NWP-102's totals bug.
- New dependencies of any kind, including a checkbox primitive.

## Open questions

- Should the "all payments" scope keep the current sort, or always fall back to newest-first? Built to keep the sort, since that is what ops sees on screen.
- Does Finance need a fixed column order independent of the order columns arrive in? Built to preserve the requested order (`columns=currency,id` writes `currency,id`), since that is the more flexible contract and the dialog always emits allowlist order anyway.
