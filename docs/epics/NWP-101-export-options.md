# EPIC · NWP-101 — Payments export options

> Written before any code. Generated manually (the `/epic` skill isn't registered in this session), following the same process the skill itself documents in `.claude/skills/epic.md`.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Kyle Atekwana
**Status:** draft

## Problem

Ops exports the payments table several times a day, and today the export gives them no say in it: every column, current filter only. The card last-four rides along in every file, so anything headed to a merchant gets hand-edited first — Dana's team puts that at 3–4 hours a month, and there was a near-miss last quarter where an unedited file almost reached the wrong merchant. They need to pick their columns (last-four off by default) and pick their scope (current filter or everything), with the row count visible before they commit to a download.

## Current state

- `src/app/payments/page.tsx:68-76` — the Export control is a plain `<a href="/api/payments/export?...">` styled as a button. It carries the page's current filter query string (built at `page.tsx:46-48`) and nothing else — no column or scope choice exists in the UI today.
- `src/app/api/payments/export/route.ts` — the whole handler is 25 lines. It calls `parseFilters` then `filterPayments` + `sortPayments` from the query builder, and pipes the result straight into `toCsv()`. Its own doc comment says exactly what's missing: *"the column set and the scope are fixed. Giving ops control over both is NWP-101."*
- `src/data/queries.ts:18-36` (`parseFilters`) already validates everything arriving from the client — status against a fixed list, sort/direction/page coerced — before it reaches a query. This is the allowlist pattern the ticket asks us to extend to column names.
- `src/data/queries.ts:45-99` — `filterPayments`, `sortPayments`, and `paginate` are separate, composable steps. `queryPayments` (`:102-106`) chains all three and is what the table and `GET /api/payments` use. The export route already calls `filterPayments`+`sortPayments` **without** `paginate` — so, contrary to what the ticket notes warn against, the export is *not* currently limited to one page. That part of the trap is already avoided; it just needs to stay that way through this change.
- `src/lib/csv.ts:13-24` — `EXPORT_COLUMNS` is a fixed tuple of 10 columns, including `last4`. `toCsv(payments, columns = EXPORT_COLUMNS)` (`:58-67`) **already accepts an optional column subset** — the serializer is half-built for this ticket. `csv.test.ts:32-36` already tests it with a custom column list. What's missing is a server-side check that a requested column name is actually one of the 10, before it's trusted.
- `src/lib/csv.ts:33-56` (`cell()`) — the `amount` case calls `formatMoney(payment.amount, payment.currency)` at serialization (`:51-52`); `currency` is its own column (`:53-54`). Acceptance criterion 4 ("minor units internally, formatted once, currency in its own column") is **already satisfied** by the existing code — nothing to build here, just to preserve.
- `src/lib/csv.ts:69-71` (`exportFilename`) — `payments-${date.toISOString().slice(0, 10)}.csv`. UTC date only, no scope or filter information, so a disputed-only export and a full export on the same day produce an identical filename. `csv.test.ts:80` tests and names this: *"stamps the UTC date, so two exports on the same day collide by design"* — that test will need to change, not just gain neighbors.
- Verified against the running dev server: `GET /api/payments/export` returns 1,658 rows (the full seed set); `GET /api/payments/export?status=disputed` returns 33. Both came back with the same `content-disposition: attachment; filename="payments-2026-08-25.csv"`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units; format once, at the edge | `build-battle/merchant-console/CLAUDE.md`, `.claude/rules/money.md` | A pre-formatted amount re-enters serialization and the amount/currency columns stop agreeing |
| One query builder — reuse `src/data/queries.ts` | `build-battle/merchant-console/CLAUDE.md` ("A second implementation is a bug, not a shortcut"), `.claude/rules/api-routes.md`, ticket notes | An "all payments" export that silently isn't all, or drifts from what `/api/payments` returns |
| Validate client input against an allowlist before it reaches a query or filename | `.claude/rules/api-routes.md`, ticket notes ("validate them server-side... do not interpolate them into SQL") | An arbitrary `columns` value reaches `cell()`'s switch, or worse, the filename, unchecked |
| Card last-four defaults to excluded | Ticket description (the near-miss); `docs/ORG-STANDARDS.md` #8 (card data masked by default) | The exact leak this ticket exists to close ships again |
| Storage and filenames bucket in UTC | `build-battle/merchant-console/CLAUDE.md`; already how `exportFilename` works today (`csv.ts:70`) | A filename date that disagrees with what "today" means everywhere else in the app |

## Approach

Extend the existing export route rather than adding a second one: accept `columns` and `scope` query parameters alongside the filters it already reads, validate `columns` against `EXPORT_COLUMNS` server-side, and branch `scope` between today's filtered path (`parseFilters` → `filterPayments` → `sortPayments`) and an unfiltered one (`filterPayments({})`, which already returns every payment — confirmed empirically above). Extend `exportFilename` to fold scope into the name. On the client, replace the bare anchor with a small dialog (Radix `Dialog`, per `.claude/rules/components.md`) that the Payments page feeds with both row counts, computed server-side, so the dialog itself never needs to fetch.

**Considered and rejected:** computing the column/row selection in the browser, from the payments already on the page. Rejected because the table only ever holds one paginated slice (`PAGE_SIZE = 20`), so anything built from what's on screen reproduces exactly the bug the ticket calls out — "current filter" scope has to mean every matching row, not the visible ones.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | Add a column-allowlist validator; change `exportFilename`'s signature to fold in scope |
| `src/app/api/payments/export/route.ts` | Change | Read and validate `columns` + `scope`; branch scope between the existing filtered path and an unfiltered one; reject an empty column list |
| `src/app/payments/page.tsx` | Change | Compute the all-payments total next to the existing filtered total; swap the Export `<a>` for the new dialog trigger |
| `src/app/payments/export-dialog.tsx` | Add | Column checkboxes (last-four off by default), scope choice, row count, Download disabled at zero columns |
| `src/lib/csv.test.ts` | Change | Extend with cases for the new validator and the changed `exportFilename` shape |
| `src/data/queries.ts` | No change | `filterPayments({})` already returns the unfiltered set — no new query path needed |

## Plan

1. **Column allowlist in `csv.ts`.** A function that takes the raw `columns` value and returns only names present in `EXPORT_COLUMNS`, in the order given. Done when: a `csv.test.ts` case shows an unknown or empty name gets dropped, not passed through.
2. **`exportFilename` takes a scope.** New shape: `payments-<scope>-<UTC date>.csv` (e.g. `payments-disputed-2026-08-13.csv`, `payments-all-2026-08-13.csv`). Done when: `csv.test.ts` asserts the new shape, and the existing "collide by design" test is updated to match rather than left contradicting it.
3. **Wire the route.** Read `columns` + `scope` in `route.ts`; validate columns via step 1; `scope=all` → `filterPayments({})`; anything else → today's `parseFilters` path. Return 400 when validated columns is empty. Done when: `curl` against the dev server shows correct rows, columns, and filename for both scopes, and an empty `columns` value returns 400, not a CSV.
4. **All-payments total on the page.** Alongside the existing `queryPayments(filters)` call, add the unfiltered count and pass both totals into the dialog. Done when: the "all payments" number in the dialog matches the seed total (1,658 in dev).
5. **Build the dialog.** Checkboxes for all 10 `EXPORT_COLUMNS` (last-four unchecked by default), scope control defaulting to current filter, row count for whichever scope is active, Download disabled at zero columns, linking to the export route with `columns` + `scope` + the page's existing filter params. Done when: manually exercising every acceptance criterion in the browser holds.
6. **Swap the button.** Replace the anchor on `/payments` with the dialog trigger. Done when: `npm test` and `npm run build` pass, and a real download's header row matches exactly what was checked.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; last-four off by default | Dialog default state + downloaded file's header row |
| Scope: current filter (default) or all payments; row count visible first | Manual comparison of the dialog's count against the page's own total, both scopes |
| Filename reflects scope and date | `csv.test.ts` case on `exportFilename`; `content-disposition` header on a real download |
| Amounts stay minor units internally, formatted once, currency its own column | Already true today (`csv.ts:51-54`) — re-confirmed by existing `csv.test.ts` cases, no new behavior |
| Deselecting every column disables Download, not an empty file | Dialog button state (manual) + the route's 400 as a server-side backstop |
| Column names validated server-side | New `csv.test.ts` case; reading `route.ts` to confirm no raw client string reaches `cell()` or the filename |
| Reuses the existing query builder | Code review — `route.ts` still calls `filterPayments`/`sortPayments`; `queries.ts` diff is empty |
| Unit test covers the column serializer; `npm test` passes | `npm test` output |

## Risks

- "All payments" scope bypasses pagination by design — fine at 1,658 seed rows, but worth flagging so a future change doesn't "fix" it into a paginated export and reintroduce the bug this ticket closes.
- `exportFilename`'s signature is changing, and it already has a test asserting today's shape. That test needs to be updated in place, not just added alongside — easy to miss and end up with two contradictory assertions.
- The Export control is the only integration point being touched on `/payments`, and this repo has no e2e test — `vitest` here covers `src/lib/` only — so the manual browser pass in step 6 is the sole check on the wiring itself.

## Out of scope

- `GET /api/payments` (the list endpoint) — unaffected, already shares the builder.
- NWP-102 — unrelated ticket.
- Persisting a user's column/scope choice between visits — not in the acceptance criteria.
- Any change to CSV quoting/escaping/encoding beyond column selection — `escapeCell` stays as-is.

## Open questions

None that the ticket or code leaves genuinely open. One implementation choice, decided rather than asked: `columns` travels as a single comma-separated query value (`columns=id,amount,currency`), not repeated keys — Download has to stay a plain link, not a form post, for "row count visible before download" to hold without client-side JS driving the request.
