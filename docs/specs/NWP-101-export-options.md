# SPEC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Leon
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day, and every file arrives with every column including the card last four. Anything going to a merchant is cleaned up by hand first — Dana estimates 3–4 hours a month, and last quarter an unedited file nearly went to the wrong merchant. Scope is stuck on whatever filter is active, with no say in what comes out.

## Current state

Every claim below carries a path. Two of them change the shape of the work.

- `src/app/api/payments/export/route.ts:12` — `GET` calls `parseFilters`, then `filterPayments` and `sortPayments` **directly**, deliberately skipping `queryPayments` so pagination never applies. The whole filtered set already exports. Columns and scope are hardcoded; the file comment names NWP-101 as the fix.
- `src/lib/csv.ts:58` — **`toCsv(payments, columns = EXPORT_COLUMNS)` already accepts a column subset.** Half of AC-1 is built. `EXPORT_COLUMNS` (line 13) is the 10-column default and doubles as the allowlist; `cell()` (line 33) resolves one column; `escapeCell()` (line 28) quotes on `[",\n]`.
- `src/lib/csv.ts:69` — `exportFilename(date)` returns `payments-<YYYY-MM-DD>.csv`, with no scope segment. AC-3 needs one.
- `src/data/queries.ts:18` — `parseFilters` is the existing server-side allowlist for status, sort, direction and page. It knows nothing about columns or scope.
- `src/app/payments/page.tsx:68` — Export is a plain `<a href="/api/payments/export?…">` wrapped in `Button asChild`. No JS today. The page is an async server component and already holds `total` from `queryPayments` (line 45), which AC-2's row count can use without a second query.
- `src/lib/csv.test.ts:32` — a test named *"writes only the requested columns, in the order given"* already passes. Its header comment says NWP-101 "changes which columns ship, not how a cell is written, and these should still pass afterwards."
- `src/lib/csv.test.ts:80` — asserts `exportFilename(date)` with a **single positional argument**. This constrains the AC-3 signature: the scope segment must be additive, not a rewrite.

**The ticket does not match the code, twice:**

- `.claude/rules/components.md` claims `src/components/` "already has … Dialog". It does not — there is no `Dialog.tsx`. `Drawer.tsx:3` is built on `@radix-ui/react-dialog` and exports Trigger/Content/Header/Title/Body/Footer/Close. There is no checkbox primitive and no `@radix-ui/react-checkbox` dependency, so column toggles are native inputs styled with Tailwind.
- `src/data/queries.ts:81` carries a **pre-existing bug in the exact path this ticket touches**: `sort=amount` compares `String(a.amount).localeCompare(...)`, so amounts order lexicographically. Ascending, `[9000, 25000, 123456789, 500]` returns `[123456789, 25000, 500, 9000]`. Verified by hand. It affects the table and the export equally. See Open questions.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md` | A column name reaches a filename or a query unchecked |
| "Column names arrive from the client, so **validate them server-side**. Do not interpolate them into SQL." | NWP-101, Notes | Same, and it is the note the ticket leads with |
| "Client-side checks are a convenience, never the enforcement" | `.claude/rules/api-routes.md` | Disabling Download in the dialog is not the empty-selection guard |
| "The payments table is paginated. Building this in the browser exports the current page only" | NWP-101, Notes | The bug we ship instead of the feature |
| "One query builder … A second implementation is a bug, not a shortcut" | `merchant-console/CLAUDE.md` | Filter drift between table and export |
| "Money is integer minor units … Format once, at the edge, next to its currency code" | `merchant-console/CLAUDE.md` | Cents drift; AC-4 fails |
| "Use what is here" / "Tailwind only" / dialogs must be operable | `.claude/rules/components.md` | A second dialog primitive, or one that traps focus |

## Approach

Server first, then the dialog — so the feature is provable by URL before any UI exists. The route grows two validated inputs: `columns`, allowlisted against `EXPORT_COLUMNS` in `src/lib/csv.ts` (order preserved, duplicates dropped, unknown names rejected with `400`), and `scope`, which selects between `parseFilters(params)` and an unfiltered query. Both paths still go through `filterPayments`/`sortPayments`, so there is no second query builder and no pagination. `exportFilename` gains an optional second positional argument for the scope segment, which keeps the existing test green. The dialog is a client component that opens the existing `Drawer`, holds column checkboxes and a scope radio group, shows the row count it was handed by the server component, disables Download when nothing is selected, and navigates to the same route by building a querystring — the download stays a plain link, so no fetch and no blob.

**Considered and rejected:** building the column choice in the browser by filtering the rendered table. It is the shortest path to a demo and it is the bug the ticket explicitly warns about — the table is paginated, so it would export 20 rows and call it "all payments". Rejected outright.

**Also rejected:** adding `src/components/Dialog.tsx` on `@radix-ui/react-dialog`. It is the more conventional shape for a short options form, but it duplicates roughly 180 lines of `Drawer.tsx` styling and accessibility for a cosmetic difference. Reusing `Drawer` costs one primitive fewer. Flagged as an open question because the difference is visible to Dana.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | change | Add the column allowlist parser next to `EXPORT_COLUMNS`; add the optional scope segment to `exportFilename` |
| `src/app/api/payments/export/route.ts` | change | Read and validate `columns` and `scope`; `400` on an unknown column or an empty selection |
| `src/lib/csv.test.ts` | change | Extend, per the DoD: subset in requested order, last four excluded by default, empty selection |
| `src/app/payments/export-dialog.tsx` | add | Client component: the Drawer, checkboxes, scope radios, row count, disabled Download |
| `src/app/payments/page.tsx` | change | Swap the bare `<a>` for the dialog trigger; pass the filtered total, the grand total, and the active querystring |

## Plan

Sequenced so each step ends somewhere checkable.

1. **Column allowlist + filename scope in `src/lib/csv.ts`** — done when: an unknown column name is rejected rather than returned, a requested subset keeps its requested order, and `exportFilename(date)` still returns `payments-2026-03-14.csv`.
2. **Route handler validation** — done when: `curl` on `?columns=id,amount` returns two columns, `?columns=id,drop_table` returns `400`, `?columns=` returns `400`, and `?scope=all` returns more rows than the same URL with `status=disputed`.
3. **Extend `src/lib/csv.test.ts`** — done when: the three new cases from the DoD pass and the original nine still do.
4. **`npm test`** — done when: the summary line shows every file passing, pasted into the PR.
5. **Export dialog component** — done when: it opens from the Export button, last four is unchecked on open, the row count matches the table footer, Escape closes it, and Download is disabled with nothing selected.
6. **Wire it into `page.tsx`** — done when: downloading with `status=disputed` and three columns yields `payments-disputed-<date>.csv` with three columns and no `last4`.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns selectable, last four **off** by default | New test in `src/lib/csv.test.ts` for the default set; open the dialog and see the box unchecked |
| Scope current-filter or all, count visible, filter is default | Compare row counts for `?status=disputed` against `?scope=all`; count in the dialog matches the table footer |
| Filename reflects scope and date | New assertion on `exportFilename(date, "disputed")`; confirm the downloaded filename |
| Amounts in minor units, formatted once, currency in its own column | Existing `toCsv` tests already pin `$1,234,567.89` quoting; `amount` and `currency` stay separate columns |
| Empty selection disables Download | Dialog: Download disabled with nothing checked. Route: `?columns=` returns `400`, since the client is not the enforcement |

## Risks

- **A `400` on an empty selection is invisible in a plain-link download** — the browser shows its own error page. The dialog must be the thing that prevents it; the `400` is the backstop.
- **`scope=all` on ~1,700 seeded payments** is fine in memory, and would not be against a real database. Worth a note in the PR, not a fix here.
- **The amount-sort bug will show up in any export sorted by amount** and will look like something this ticket broke. Resolve the open question before step 2 so the PR can say which it is.

## Out of scope

- Persistence of any kind. No database, no ORM, no migrations — that is NWP-203.
- Saved export presets, scheduled exports, and formats other than CSV. Not asked for.
- Date-range filters (`from`/`to` exist in `parseFilters` but no UI offers them).

## Open questions

1. **Fix the `sortPayments` amount bug in this PR, or file it separately?** Recommendation: fix it here. It is two lines, it corrupts the file this ticket ships, and the PR template has a "Bugs fixed along the way" section that expects exactly this. The argument against is a ticket that stays honest to its title.
2. **`Drawer` or a new centered `Dialog`?** Recommendation: `Drawer`, on the reasoning above. Cosmetic, reversible, and cheap to change later.
