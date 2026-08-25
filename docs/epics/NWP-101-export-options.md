# EPIC · NWP-101 — Payments export options

> Written before code, then edited as the shape firmed up. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Sanj
**Status:** done

## Problem

Ops exports the payments table several times a day — merchant queries, month-end reconciliation, anything Finance asks for — and the export is fixed: every column, current filter only, no say in what comes out. The card last-four rides along in every file, so anything going to a merchant has to be cleaned by hand first. Dana's team estimates 3–4 hours a month on that cleanup, and there was a near-miss last quarter where an unedited file almost went to the wrong merchant.

## Current state

- `src/app/api/payments/export/route.ts` already exports server-side and already skips pagination — it calls `filterPayments`/`sortPayments` from the query builder without `paginate`, so it was never actually vulnerable to the "browser exports only the current page" bug the ticket warns about. What it lacks is column and scope control: it calls `toCsv(rows)` with no column argument and `exportFilename()` with no date argument.
- `src/lib/csv.ts` already anticipates this ticket. `toCsv(payments, columns = EXPORT_COLUMNS)` already accepts a column subset — its second parameter was unused by any caller. `EXPORT_COLUMNS` is a fixed 10-column tuple including `last4` unmasked. The file's own header comment named NWP-101 as the reason the column set isn't controllable yet.
- `src/data/queries.ts`'s `parseFilters(params: URLSearchParams): PaymentFilters` is the established server-side allowlist chokepoint: a module-level readonly array, `.includes()`, fallback to a safe default, never throws. It is the pattern this ticket's column/scope parsing follows.
- `src/app/payments/page.tsx` did **not** call `parseFilters`. It hand-rolled its own parse with a local `STATUSES` array that omitted `from` and `to`, while the export route's `parseFilters` reads both. That meant the page's row count and the export's row count could disagree for any URL carrying a date range — a second filter path (a defect per every layer of this repo's conventions), and one that blocked this ticket's AC 2 outright, since the dialog needed to show a row count that actually matched what would download.
- `src/components/` has no `Dialog`, `Checkbox`, `RadioGroup`, or `Label`. `.claude/rules/components.md` claims a `Dialog` exists — it doesn't; only `Drawer.tsx` (a right-side sheet on `@radix-ui/react-dialog`) does. `@radix-ui/react-dialog` is installed; the checkbox/radio-group/label Radix packages are not.
- `src/app/payments/filter-bar.tsx` is the only `"use client"` file in the app. Its `apply()` rebuilds the URL's `URLSearchParams` from scratch on every filter change, which would silently drop any export state kept in the URL.
- `vitest.config.ts` sets `include: ["src/**/*.test.ts"]` with `environment: "node"` — `.tsx` files are not collected and there is no DOM, so every unit worth testing has to be a pure function in a `.ts` file.
- `src/data/queries.ts`'s `sortPayments` compared amounts as text (`String(a.amount).localeCompare(String(b.amount))`) — a bug in the exact query builder this ticket reuses, found while reading it, not part of the ticket's AC.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate everything from the client against an allowlist before it reaches the store, a query, or a filename" | `.claude/rules/api-routes.md`, `docs/ORG-STANDARDS.md` #7 | A client-controlled string reaches `Content-Disposition` — e.g. a bare `"` closes the quoted attribute and lets a `filename*=` parameter override the saved name entirely |
| "Reuse the query builder... a second filter path is a defect" | `.claude/rules/api-routes.md`, ORG-STANDARDS #6 | Reading `store.payments` directly for the "all payments" scope |
| "Money is integer minor units... Format once, at the edge" | `CLAUDE.md` #1, `.claude/rules/money.md` | Amounts formatted twice, or a formatted string stored/compared |
| "Every input has a label, the dialog has an accessible name, focus moves into it and returns on close, Escape closes it" | `.claude/rules/components.md` | An inoperable dialog |
| "Tailwind only. No inline `style`" | `.claude/rules/components.md` | — |
| Card last-four never widened toward a full PAN | `.claude/rules/cards.md`, ORG-STANDARDS #8 | Cardholder data disclosed by default |

## Approach

Everything the client can influence — column names and scope — gets validated in `src/lib/csv.ts`, next to the tuple it validates against, following `parseFilters`'s allowlist idiom exactly: module-level readonly arrays, `.includes()`/`Set` membership, a safe fallback, never a throw. The route rejects only the one case with no safe fallback (zero valid columns, where falling back to the full set would silently re-enable `last4`). "All payments" scope is expressed by calling the existing query builder with an empty filter set, never by reading the store directly. The dialog is a new `Dialog.tsx` on the Radix primitive already installed for `Drawer`, with native `<input type="checkbox">`/`<input type="radio">` inside `<fieldset>`s — no new npm dependency.

**Considered and rejected:**
- *Reusing `Drawer` instead of adding `Dialog.tsx`.* Smaller diff, and Escape/focus-return come free either way. Rejected because it's a right-side sheet, not the centered "options dialog" the ticket asks for, and `components.md` already assumes a `Dialog` exists — this fills a real gap rather than adding one.
- *Adding `@radix-ui/react-checkbox` and `@radix-ui/react-radio-group`.* Would give fully-styled primitives. Rejected: `components.md` says to reach for what's here before adding a dependency, and native inputs give real label association, keyboard semantics, and form serialization for free.
- *Column/scope state in the URL.* Would survive a page reload. Rejected: `filter-bar.tsx`'s `apply()` rebuilds the query from scratch on every filter change and would silently drop it, and a URL-persisted `last4` opt-in becomes a shareable, permanent disclosure — exactly what "off by default" exists to prevent.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/app/payments/page.tsx` | Change | Route through `parseFilters` (fixes the second filter path), compute the all-payments count, strip `page` from the export query, mount the dialog |
| `src/lib/csv.ts` | Change (additive) | `DEFAULT_EXPORT_COLUMNS`, `parseExportColumns`, `parseExportScope`, `exportSlug`, filename sanitizing |
| `src/lib/csv.test.ts` | Change | Extended per the DoD — no new test file |
| `src/app/api/payments/export/route.ts` | Change | Reads scope + columns, rejects zero columns early, slugs the filename, adds `nosniff`/`no-store` |
| `src/components/Dialog.tsx` | Add | Centered modal on the already-installed Radix dialog primitive |
| `src/app/payments/export-dialog.tsx` | Add | The options form; second `"use client"` file in the app |
| `src/data/queries.ts` | Change | Numeric amount sort (bug found while reading the reused query builder) |
| `src/data/queries.test.ts` | Add | Covers the sort fix; a new file, since the DoD's "extend the existing file" scopes to the CSV serializer |
| `build-battle/merchant-console/CLAUDE.md` | Change | Adds a Commands section; documents the vitest `.tsx`/node-environment scope; names `parseFilters` and `filter-bar.tsx` as the chokepoints convention #3/#4 describe |
| `.claude/rules/components.md` | Change | Corrects the stale claim that `Dialog`/`Checkbox`/`RadioGroup`/`Label` already exist |

## Plan

1. **Fix the second filter path in `page.tsx`** — done when: the page's displayed row count and the export's row count agree for a URL carrying `from`/`to`, verified by curl against the route and the rendered dialog.
2. **Add the allowlists and filename sanitizing to `csv.ts`** — done when: `npm test` passes with the new cases and the two pre-existing `csv.test.ts` assertions are byte-identical.
3. **Wire the export route** to the new parsers with a reject-early 400 on zero columns — done when: `?columns=bogus` returns 400 and never reaches `toCsv`.
4. **Add `Dialog.tsx`** — done when: it renders centered, traps focus, and Escape closes it with focus returning to the trigger.
5. **Add `export-dialog.tsx`** and wire it into `page.tsx` — done when: default state has `last4` unchecked, deselecting every column disables Download with a visible, `aria-live` reason, and the row counts in both radio labels match the query builder's counts.
6. **Fix `sortPayments`'s text-based amount comparison**, in its own commit, with its own test file — done when: sorting by amount orders numerically.
7. **Update the two documentation files** — done when: `components.md` no longer claims a nonexistent `Dialog`, and `CLAUDE.md` states the vitest `.tsx` gap and names the allowlist/client-component chokepoints.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; `last4` off by default | `parseExportColumns(null)` (and `[]`, matching `URLSearchParams.getAll`'s empty-array-when-absent behavior) excludes `last4`; `toCsv` on the default set contains neither `"last4"` nor a fixture `4242`. Confirmed in the browser: dialog opens with Card last four unchecked. |
| Scope choice; current filter default; row count visible before download | Radio labels carry live counts sourced from the same `queryPayments`/`filterPayments` calls the export uses. Confirmed: `/payments?status=disputed` showed "Current filter — 33 payments", and `curl .../export?status=disputed \| wc -l` produced 33 data rows — the count and the file agree. `scope=all` showed 1,658 and the export returned all 1,658 rows. |
| Filename reflects scope and date | Unit tests assert the ticket's literal example (`payments-disputed-2026-08-13.csv`) and the `all` case; confirmed live via curl (`payments-disputed-2026-08-25.csv`, `payments-all-2026-08-25.csv`). |
| Amounts in minor units internally, formatted once, currency its own column | Unchanged — `cell()` already calls `formatMoney` at the CSV boundary and `currency` was already its own column; no code change needed for this criterion, only confirmation. |
| Deselecting every column disables Download | Confirmed live: unchecking all ten columns disables the Download button and shows "Select at least one column to download." via a `role="status"` live region. Server backstop confirmed via curl: `?columns=bogus` → 400 `{"message":"Select at least one column to export."}`. |

`npm test` — 57 tests pass (`money.test.ts`, `dates.test.ts`, `csv.test.ts`, `queries.test.ts`). `npm run lint` — no warnings. `npx tsc --noEmit` — clean.

## Risks

- **Falling back to the full column set on an empty/invalid request** would silently re-enable `last4` for anyone who forgot a `columns` param. Mitigated by rejecting with 400 rather than ever substituting `EXPORT_COLUMNS`.
- **A raw client string reaching `Content-Disposition`** — mitigated by sanitizing inside `exportFilename` itself (an ASCII allowlist, length-capped) rather than trusting every caller to have already validated its input; and by the fact that only allowlisted `status`/`scope` values ever reach the slug in the first place.
- **`URLSearchParams.getAll` returns `[]`, not `null`, for an absent param** — an easy off-by-assumption that broke the "no `columns` param" default path during manual verification (every default export 400'd). Caught by testing against the live route before considering the work done; fixed and pinned with a regression test.

## Out of scope

- **CSV formula injection** (`escapeCell` doesn't neutralize a leading `=`/`+`/`-`/`@`, so a crafted `description` could execute as a formula in Excel). Real, but the test file's own header comment states NWP-101 "changes which columns ship, not how a cell is written," and fixing it would break the pinned escaping tests. Filed as a follow-up rather than fixed here.
- **Metrics/aggregation bugs** (float accumulation, local-date bucketing, refunds inflating gross volume) — owned by NWP-102, whose own ticket says not to fix what it finds in the same session.
- **Persistence** — tracked separately as NWP-203.
- **`Drawer.tsx`'s close button has no accessible name** (`aria-hidden` icon, no text, no `aria-label`) — a pre-existing defect in a component this ticket didn't touch. Not fixed here.

## Open questions

- Should the filename slug also cover the case where a non-status filter (merchant, search, date range) is active but status is `"all"`? Currently that case yields the bare `payments-<date>.csv`, identical to a genuinely unfiltered export. Left as-is for this ticket; worth a follow-up if ops finds it confusing in practice.
