# EPIC · NWP-101 — Payments export: columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Snow Lee
**Status:** draft

## Problem

Dana Whitfield's ops team exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for. The export works but has no options: every column, current filter only. The card last-four is in every file, so anything going to a merchant is cleaned by hand first. That is 3–4 hours a month of spreadsheet editing, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

Most of the serializer already exists. The route simply never passes it anything.

- `src/app/payments/page.tsx:68` — the Export button is a plain `<a>` pointing at `/api/payments/export?<current query>`. No dialog, no options, no confirmation.
- `src/app/api/payments/export/route.ts` — the export route. Calls `parseFilters`, then `filterPayments` + `sortPayments`, then `toCsv(rows)` with no column argument. Its own comment names NWP-101 as the ticket that adds column and scope control.
- `src/lib/csv.ts:13` — `EXPORT_COLUMNS`, the ten-column allowlist, and the `ExportColumn` type. Already the right shape for server-side validation.
- `src/lib/csv.ts:58` — **`toCsv` already accepts a `columns` argument** and defaults to all of them. The column serializer is largely built.
- `src/lib/csv.test.ts:32` — a test already pins "writes only the requested columns, in the order given". The existing suite should still pass untouched.
- `src/lib/csv.ts:69` — `exportFilename(date)` stamps the UTC date only. No scope segment.
- `src/data/queries.ts:18` — `parseFilters`, the server-side allowlist for status, sort, and direction. It has no notion of `columns` or `scope`; this is where both belong.
- `src/data/queries.ts:45` — `filterPayments`, the one query builder. `PAGE_SIZE = 20` at `:43`.
- `src/lib/money.ts:15` — `formatMoney`, already called at `src/lib/csv.ts:52`, with `currency` as its own column at `:53`. **AC4 is already satisfied by the existing code** and the job is not to break it.
- `src/app/payments/page.tsx:45` — the page already receives `total` for the current filter from `queryPayments`, so the filtered row count needs no new endpoint.

Two things in the docs do not match the code:

- `.claude/rules/components.md` claims `src/components/` has a Dialog. It does not — only `src/components/Drawer.tsx`, which wraps `@radix-ui/react-dialog`. The dependency is installed (`package.json`). **Decision: add `src/components/Dialog.tsx`** in the same Tremor style, which closes the gap rather than working around it.
- `src/data/queries.ts:81` sorts amounts with `String(a.amount).localeCompare(...)`, so `9000` sorts after `25000`. Lexicographic, and wrong. It changes export row order when `sort=amount`. **Not this ticket** — noted under Risks.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge next to its currency code | `merchant-console/CLAUDE.md` conv. 1 | Cents drift on every total |
| "Anything from the client — column names, currencies, limits, statuses — is checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md` conv. 4, `.claude/rules/api-routes.md` | A client-supplied column name reaches a filename or a query |
| "Payment filtering goes through the builder behind `GET /api/payments`. A second implementation is a bug, not a shortcut" | `merchant-console/CLAUDE.md` conv. 3 | Two filter paths that drift apart |
| Storage and bucketing are UTC | `merchant-console/CLAUDE.md` conv. 2 | Filename date is wrong either side of midnight |
| "Dialogs and forms must be operable" — label per input, accessible name, focus in and back out, Escape closes | `.claude/rules/components.md` | Keyboard-only ops cannot export |
| "The payments table is paginated. Building this in the browser exports the current page only" | ticket, Notes from the team | Ships a 20-row file as the feature |

## Approach

Extend the export route that already exists rather than adding a second one. Two new client-supplied parameters, `columns` and `scope`, get parsed and allowlisted server-side in `src/data/queries.ts` alongside `parseFilters` — `columns` intersected against `EXPORT_COLUMNS`, `scope` against `filtered | all`. `scope=all` calls the same `filterPayments` with empty filters, so there is still exactly one query builder. `toCsv` already takes the column list, so it needs no change; `exportFilename` grows a scope segment. On the client, a new `Dialog.tsx` primitive plus a payments-specific options dialog collects the choices and builds the href. The server page already knows both row counts and passes them in, so the count is on screen before download with no extra endpoint and no fetch in a component.

**Considered and rejected:** generating the CSV in the browser from the rows already rendered. It needs no API work at all, and it is wrong — the table is paginated at 20 rows (`src/data/queries.ts:43`), so it would export one page and present it as the feature. The ticket names this specific mistake.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/data/queries.ts` | change | Add `parseExportOptions` beside `parseFilters` — the server-side allowlist for `columns` and `scope`. Validation lives with the other validation |
| `src/app/api/payments/export/route.ts` | change | Read the validated options, pick the row set by scope, pass columns to `toCsv`, use the new filename. Reject an empty column set with 400 |
| `src/lib/csv.ts` | change | `exportFilename` takes a scope segment. `toCsv` unchanged |
| `src/lib/csv.test.ts` | change | Extend with the column-serializer and filename cases the DoD asks for. Existing cases stay |
| `src/components/Dialog.tsx` | add | The modal primitive `components.md` already documents. Wraps `@radix-ui/react-dialog`, styled like `Drawer.tsx` |
| `src/app/payments/export-dialog.tsx` | add | Client component: column checkboxes, scope radio, live row count, disabled Download, builds the export href |
| `src/app/payments/page.tsx` | change | Swap the plain Export `<a>` for the dialog; pass the current query, the filtered total, and the unfiltered total |

## Plan

1. **Filename segment** — `exportFilename` takes scope and status and returns `payments-disputed-2026-08-13.csv`, `payments-all-…`, `payments-filtered-…`. *Done when:* new cases in `src/lib/csv.test.ts` pass and the existing UTC-date case still does.
2. **Server-side options allowlist** — `parseExportOptions` in `src/data/queries.ts`: unknown column names dropped, order canonicalised to `EXPORT_COLUMNS`, `scope` defaulted to `filtered`, last4 excluded unless explicitly asked for. *Done when:* unit tests cover an unknown column, a duplicate, and an empty list.
3. **Wire the route** — `src/app/api/payments/export/route.ts` uses the options; `scope=all` calls `filterPayments({})`; empty columns returns 400 with a user-safe message. *Done when:* hand-built URLs produce the right file — `?columns=id,amount`, `?scope=all`, `?columns=` → 400, `?columns=id,pass<word` → ignored, not echoed.
4. **Dialog primitive** — `src/components/Dialog.tsx`. *Done when:* it opens, traps and returns focus, closes on Escape, and has an accessible name.
5. **Options dialog** — `src/app/payments/export-dialog.tsx`, last4 unchecked by default, count text switching with scope, Download disabled at zero columns. *Done when:* clicking Download in the browser downloads the file the options describe.
6. **Page wiring** — replace the `<a>` in `src/app/payments/page.tsx`, pass both totals. *Done when:* the count shown matches the footer count at `page.tsx:142` for the current filter.
7. **Full pass** — `npm test`, then `/ship-ready`. *Done when:* both are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns are selectable, last4 off by default | Open the dialog with no interaction, download, confirm no `last4` header. Unit test on the option parser's default |
| Scope current-filter or all, current is default, count visible before download | Filter to `disputed`, open the dialog: count matches `page.tsx:142`. Switch to all payments, count rises to the unfiltered total. Downloaded row count matches |
| Filename reflects scope and date | `src/lib/csv.test.ts` cases for all three segments; confirm the `content-disposition` header on a real download |
| Amounts stay minor units, formatted once, currency in its own column | Existing `csv.test.ts:32` and `:38` still pass untouched; grep the diff for arithmetic on `payment.amount` — there should be none |
| Deselecting every column disables Download | Uncheck all in the browser: button disabled. Then `curl` the route with `?columns=` and confirm 400, not an empty file |
| Unit test covers the column serializer, `npm test` passes | `npm test` output pasted into the PR |

## Risks

- **A second query path sneaks in via `scope=all`.** Mitigation: `scope=all` must call `filterPayments({})`, not read `store.payments` directly.
- **Client-supplied column names reaching the filename or the header row.** Mitigation: the route never uses a client string — it maps to values from `EXPORT_COLUMNS` and drops the rest. Verify by requesting a junk column name and confirming it is absent from the response, including any error body.
- **`src/data/queries.ts:81` sorts amounts lexicographically.** Pre-existing, and it makes `sort=amount` exports come out in a surprising order. Not fixed here; flagged in the PR under bugs found so it does not read as introduced by this change.
- **Scope=all on a large store.** The in-memory store makes this cheap today; a real dataset would need streaming. Noted, not built.

## Out of scope

- Persisting a preferred column set between exports — needs storage, and there is none (NWP-203).
- Export formats other than CSV.
- Date-range filters in the dialog; `from`/`to` already parse at `src/data/queries.ts:30` but no UI sets them.
- Fixing the amount sort at `src/data/queries.ts:81`.

## Open questions

- Should `scope=all` ignore *every* filter, or keep the merchant filter and drop only status and search? Read as "all payments", literally everything, which is what the plan assumes. Worth confirming with Dana before it ships.
- Is a column order preference wanted, or is the canonical `EXPORT_COLUMNS` order fine for every consumer? Assuming canonical.
