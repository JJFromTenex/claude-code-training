# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** you
**Status:** draft

## Problem

Ops exports the payments table several times a day and gets every column, current filter only, every time. Card last-four ships in every file, so anything headed to a merchant needs manual cleanup first — about 3–4 hours a month, and a near-miss last quarter where an unedited file nearly reached the wrong merchant.

## Current state

- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?${query}">`, where `query` is whatever filter params (`status`, `merchantId`, `search`, `page`) are already on the URL. No dialog, no column or scope choice.
- `src/app/api/payments/export/route.ts` — the GET handler parses filters with `parseFilters()`, then calls `filterPayments(filters)` and `sortPayments(...)` **directly**, not `queryPayments()`. This matters: `filterPayments` never applies pagination (`paginate()` only runs inside `queryPayments`), so the export route already returns every matching row today, not just the current page. The ticket's pagination warning ("building this in the browser exports the current page only") is a warning against *regressing* this in the new UI — e.g. by having the dialog submit the 20 rows already rendered on screen instead of re-querying server-side — not a description of an existing bug.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` is a fixed, ordered tuple of 10 columns including `last4`. `toCsv(payments, columns = EXPORT_COLUMNS)` **already accepts a column subset** and preserves order — the serializer needs no structural change, just a caller that passes something other than the default. `exportFilename(date = new Date())` returns `payments-YYYY-MM-DD.csv` with no scope token.
- `src/lib/csv.test.ts` — pins the escaping contract and the column-subset behavior already. Its own header comment says NWP-101 changes which columns ship, not how a cell is written, and that these tests should still pass unmodified.
- `src/data/queries.ts` — `parseFilters()` is the one allowlisting entry point for anything client-supplied; `filterPayments()` / `sortPayments()` / `paginate()` / `queryPayments()` are the one query builder. No `columns` or `scope` concept exists here today — that belongs in `csv.ts`, since it's an export-only concern, not a payment-query concern.
- `src/data/types.ts` — `PaymentFilters` has no `columns` or `scope` field. Doesn't need one: the export route can read those two params independently of `parseFilters`.
- No `Checkbox` or `RadioGroup` component exists in `src/components/`. `src/components/Drawer.tsx` wraps `@radix-ui/react-dialog` and already handles focus-trap/Escape/overlay per the components rule — it's the dialog primitive to reuse, not a new one.
- `src/app/payments/filter-bar.tsx` is the pattern to copy for the new dialog: a `"use client"` sibling file next to `page.tsx`, taking server-computed props, using `next/navigation`'s `useRouter` to build a URL.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md` convention 1 | `toCsv` already formats via `formatMoney` at serialization — do not touch amounts anywhere upstream of `csv.ts` |
| One query builder | `CLAUDE.md` convention 3, `api-routes.md` | The export route must keep calling into `src/data/queries.ts`, not filter `store.payments` itself for the "all payments" scope |
| Validate on the server | `CLAUDE.md` convention 4, ticket notes | `columns` and `scope` arrive from the client and must be checked against an allowlist before reaching `toCsv` or the filename — never interpolated, never trusted as-is |
| Dialogs and forms must be operable | `components.md` | Every checkbox/radio needs a real `<label>`; Drawer/Radix gives focus-trap and Escape for free, but the labels are on us |
| Write the empty and error states | `components.md` | Zero columns selected must disable Download, not produce an empty file (this is also acceptance criterion 5) |

## Approach

Add a new `"use client"` sibling, `src/app/payments/export-dialog.tsx`, built on `Drawer`, triggered from the existing Export button in `page.tsx`. It holds two pieces of local state — selected columns (default: `EXPORT_COLUMNS` minus `last4`) and scope (`"current" | "all"`, default `"current"`) — and shows the row count for whichever scope is selected. Both counts (`current` = today's filtered total, `all` = every payment) are computed server-side in `page.tsx` via the existing query builder and passed down as props, so the dialog never needs its own fetch or loading state — the numbers are already known at page-render time and only the display switches on toggle. Submitting builds a GET URL to `/api/payments/export` carrying the active filters plus `columns` and `scope`, so the download still goes through a real server request (not a client-side blob), keeping the server the source of truth for both validation and the full unpaginated row set.

**Considered and rejected:** doing the CSV assembly client-side from the rows already on screen. Rejected because it's exactly the pagination bug the ticket warns about — the browser only ever has the current page's 20 rows — and because it would mean re-validating and re-serializing columns in two places instead of one.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Add `ExportScope` type, `DEFAULT_EXPORT_COLUMNS` (all but `last4`), `parseColumns(param)` and `parseScope(param)` allowlist helpers, and extend `exportFilename` to take a scope token |
| `src/lib/csv.test.ts` | Change (extend, don't replace) | Cover `parseColumns` (unknown column dropped, empty/missing → default), `parseScope`, and the new `exportFilename` signature |
| `src/app/api/payments/export/route.ts` | Change | Read `columns`/`scope` via the new `csv.ts` helpers; branch `scope=all` through `filterPayments({})` (bypassing the active UI filters entirely) vs. `scope=current` through today's `filterPayments(filters)` path; pass resolved columns into `toCsv` |
| `src/app/payments/export-dialog.tsx` | Add | The options dialog: column checklist, scope radios, live count display, disabled Download at zero columns |
| `src/app/payments/page.tsx` | Change | Compute the "all payments" count via `queryPayments({ status: "all" }).total`; swap the plain `<a>` Export link for the dialog trigger; pass filters and both counts into the new component |

## Plan

1. **Extend `csv.ts`** with the scope type, default-columns constant, `parseColumns`/`parseScope`, and the scope-aware `exportFilename`. Done when: the new pure functions exist and the existing exports (`toCsv`, `EXPORT_COLUMNS`) are untouched.
2. **Extend `csv.test.ts`** for the new helpers. Done when: `npx vitest run src/lib/csv.test.ts` passes, including every pre-existing case unmodified.
3. **Wire the export route** to the new helpers and the scope branch. Done when: `curl "localhost:3000/api/payments/export?scope=all&columns=id,amount"` downloads a two-column CSV covering every payment regardless of any status/merchant filter, and an unknown column name in the query string is silently dropped rather than erroring or appearing in the output.
4. **Build `export-dialog.tsx`.** Done when: opening it shows every column checked except `last4`, "current filter" selected by default with the current total shown, switching to "all payments" swaps in the other count with no network request, and Download is disabled the moment every column is unchecked.
5. **Wire it into `page.tsx`.** Done when: clicking Export opens the dialog instead of downloading immediately, and closing without submitting leaves the table and URL untouched.
6. **Full pass against acceptance criteria**, `npm test`, `npm run lint`. Done when: every box below is checked with a noted artifact (screenshot, curl output, or test name) for the PR description.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Screenshot of the dialog's initial checkbox state |
| Scope choice (current filter / all payments), current filter default, row count visible before download | Screenshot showing the count changing as scope is toggled |
| Filename reflects scope and date | `curl -I` the export endpoint for both scopes, inspect `content-disposition` |
| Amounts stay minor units internally, formatted once on the way out with currency in its own column | `csv.test.ts` case asserting a formatted amount plus a separate `currency` cell |
| Deselecting every column disables Download | Screenshot/interaction: uncheck all, Download is disabled, no request fires |
| Column names validated server-side, never interpolated | `csv.test.ts` case for `parseColumns` dropping an unrecognized name; route uses `parseColumns`, not raw `searchParams.get` |
| Export ignores pagination (already true) — must not regress | `curl` the export route with a filter matching >20 rows, count rows in the response |
| Reuses the existing query builder | Code review: `export/route.ts` still imports from `data/queries.ts`, no second `store.payments.filter` |

## Risks

- The ticket gives one filename example (`payments-disputed-2026-08-13.csv`) and doesn't fully specify the token for every case (no status filter, or an "all payments" export). Plan: derive the token from the active status filter when scope is `current` and one is set, fall back to `"filtered"` when scope is `current` with other filters but no status, and use `"all"` for the all-payments scope — pin this exactly in `csv.test.ts` so it's unambiguous, and call the convention out explicitly in the PR description since a reviewer may have pictured something slightly different.
- Hand-rolling checkboxes/radios (no `Checkbox`/`RadioGroup` component exists yet) risks drifting from the accessibility bar in `components.md`. Mitigate by giving every input a real `<label htmlFor>` and verifying keyboard-only operation (Tab to each control, Space to toggle, Escape to close) before calling it done.

## Out of scope

- Remembering column/scope preference across sessions — not in the acceptance criteria.
- Export formats other than CSV.
- NWP-102 (the totals-mismatch bug) — unrelated ticket.
- Persistence changes of any kind — the store staying in-memory is a separate ticket (NWP-203) per the app's own `CLAUDE.md`.

## Open questions

- None blocking. The filename-token convention above is a judgment call, not a gap in the ticket — flag it in the PR rather than treating it as settled fact if a reviewer expects different wording.
