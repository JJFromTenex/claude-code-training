# SPEC · NWP-101 — Payments export: column and scope options

> Written before any code. Planned in Claude Code plan mode, then reviewed by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Melinda Ding
**Status:** building

## Problem

Ops exports the payments table several times a day and hands the file to merchants and Finance. Every file carries the card last-four, so anything merchant-bound is scrubbed by hand first — 3–4 hours a month, and one near-miss where an unscrubbed file almost reached the wrong merchant. Ops needs to say which columns go out and whether the file is the current filter or everything, before they click.

## Current state

- `src/app/payments/page.tsx:69` — Export is a plain `<a href="/api/payments/export?…">` carrying the page's search params. Server component; no client state.
- `src/app/api/payments/export/route.ts` — `parseFilters` → `filterPayments` → `sortPayments` → `toCsv(rows)` → `text/csv` response. It deliberately never calls `paginate()`, so it already covers the whole filtered set, not the visible page.
- `src/data/queries.ts` — the one query builder. `parseFilters` allowlists `status`, `sort`, `direction`. Not touched by this ticket.
- `src/lib/csv.ts` — `EXPORT_COLUMNS` (10 columns, `last4` included), `toCsv(payments, columns)` **already accepts an ordered subset**, `exportFilename(date)`. `formatMoney` is called once, in the `amount` cell; `currency` is already its own column — AC4 holds today.
- `src/lib/csv.test.ts` — 8 tests pin escaping, subset ordering, and the filename. They keep passing.
- `src/components/Drawer.tsx` — the project's `@radix-ui/react-dialog` wrapper (title, description, focus trap, Escape). No `Dialog.tsx`, no `Checkbox` component, no Radix checkbox dependency.
- Row counts already exist server-side on the page: `queryPayments(filters).total` and `filterPayments({}).length`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Validate everything from the client against an allowlist before it reaches the store, a query, or a filename" | `.claude/rules/api-routes.md` | A column name from the URL reaches a serializer or a filename unchecked |
| "Reuse the query builder … Writing a second filter path is a defect" | `.claude/rules/api-routes.md` | Table and export disagree on what "disputed" means |
| "Money is integer minor units … Format at the edge" | `.claude/rules/money.md` | Cents drift; two formatters disagree |
| "The payments table is paginated. Building this in the browser exports the current page only" | ticket notes | A 20-row file labelled as the whole month |
| "Dialogs and forms must be operable … the dialog has an accessible name" | `.claude/rules/components.md` | Screen readers get an unlabelled panel |

## Approach

Three thin layers, none of them new patterns. `src/lib/csv.ts` gains the option vocabulary — a default column set without `last4`, a scope type, parsers that validate `columns` and `scope` against allowlists, and a filename that carries a scope label. The route handler reads the two new params, answers 400 `{ message }` to anything off the allowlist, and otherwise runs exactly as today. A client `ExportDrawer` replaces the bare anchor: checkboxes for columns, radios for scope with the live row count, and a Download link that only exists when at least one column is chosen.

**Considered and rejected:** fetching counts from `/api/payments` inside the drawer (the page already has both numbers); a new centered `Dialog.tsx` (the Drawer is the same Radix primitive, already accessible); silently dropping unknown column names the way `parseFilters` defaults status (column names are the security-sensitive input — a 400 is the honest answer); keeping all-columns-including-last4 as the no-param default (that default is the bug the ticket exists for).

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Add `DEFAULT_EXPORT_COLUMNS`, `ExportScope`, `parseExportColumns`, `parseExportScope`, `exportLabel`; extend `exportFilename(date, label?)` | One allowlist, one default, unit-testable without a DOM |
| `src/app/api/payments/export/route.ts` | Read `columns` and `scope`; 400 on invalid; scope `all` bypasses filters; labelled filename | Server-side enforcement of AC1, AC2, AC3, AC5 |
| `src/app/payments/export-drawer.tsx` | New client component | AC1, AC2, AC5 in the UI |
| `src/app/payments/page.tsx` | Swap the anchor for `<ExportDrawer>`; compute `allCount` | Wire counts and filters in |
| `src/lib/csv.test.ts` | Extend | Definition of done |

## Plan

1. **`csv.ts` parsers and defaults** — done when: `npm test` still shows 8 passing and `tsc` is clean.
2. **Route handler** — done when: `curl` shows no `last4` in the default header, 400 for `columns=` and `columns=id,pan`, and `filename="payments-disputed-<date>.csv"` for `?status=disputed`.
3. **Drawer + page wiring** — done when: Export opens a dialog with a title, `last4` is unchecked, the count changes with scope, unchecking everything disables Download, Escape closes.
4. **Tests** — done when: new cases cover subset-in-order, last4-off-by-default, empty selection, unknown column, and the labelled filename; `npm test` is green.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Choose columns; last4 off by default | Unit tests; `curl …/export \| head -1` lacks `last4`; `?columns=id,last4` includes it |
| Scope current/all; default current; count visible | `?status=disputed` row count < `?status=disputed&scope=all`, which equals the dashboard's payment total; drawer shows both counts |
| Filename reflects scope and date | `content-disposition` header carries `payments-disputed-…` / `payments-all-…` |
| Minor units internal; formatted once; currency own column | Unchanged path; existing `toCsv` tests pin `$250.00` |
| Empty selection disables Download | Drawer renders a disabled button; server answers 400 to `columns=` |

## Risks

- The bare URL's default changes: no `columns` now means no `last4`. Intended; called out in the PR.
- Native checkboxes need explicit Tailwind classes to match Tremor in dark mode.
- `sortPayments` compares amounts as strings (`src/data/queries.ts:80`). Pre-existing, affects table and export alike — out of scope, noted in the PR.

## Out of scope

- Remembering a user's column choice (NWP-203 owns persistence).
- The amount sort bug; the NWP-102 dashboard bugs.
- A reusable `Checkbox` component.

## Open questions

- None blocking.
