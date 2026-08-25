# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** gautam.kumar@gmail.com
**Status:** draft

## Problem

Ops exports the payments table several times a day — merchant queries, month-end reconciliation, whatever Finance asks for — and the export is fixed: every column, current filter only. The card last-four is in every file, so anything going to a merchant is cleaned up by hand first. Dana's team spends 3–4 hours a month on that editing, and last quarter an unedited file nearly went to the wrong merchant.

## Current state

- `src/app/payments/page.tsx:68` — Export is a plain `<a href="/api/payments/export?…">` that forwards the page's own query string. The browser handles the download; no client JS assembles the file.
- `src/app/api/payments/export/route.ts` — calls `parseFilters`, then `filterPayments` + `sortPayments`, deliberately **skipping** `paginate`. Its own comment (lines 5–10) names the fixed column set and scope as NWP-101.
- `src/lib/csv.ts:13` — `EXPORT_COLUMNS`, ten columns, `last4` among them. `toCsv` (`:58`) **already accepts a `columns` argument** defaulting to that list. `cell()` (`:33`) maps one column; `escapeCell()` (`:28`) handles commas, quotes, newlines.
- `src/lib/csv.ts:69` — `exportFilename()` stamps the UTC date only. No scope token.
- `src/data/queries.ts:18` — `parseFilters`, the server-side allowlist. `:45` `filterPayments`, `:72` `sortPayments`, `:102` `queryPayments` (which paginates at `PAGE_SIZE = 20`).
- `src/lib/csv.test.ts` — 9 passing tests. `:32` already exercises a column subset. Its header comment states NWP-101 changes *which* columns ship, not *how* a cell is written.

**Where the ticket and the code disagree:**

- `.claude/rules/components.md` says `src/components/` already has a Dialog. It does not. `Drawer.tsx` wraps `@radix-ui/react-dialog` and exports Root/Trigger/Content/Header/Title/Body/Footer/Close — that is the dialog primitive, under another name.
- There is **no Checkbox or RadioGroup** component, and no `@radix-ui/react-checkbox` in `package.json`. Column toggles need native inputs styled with Tailwind, or a new dependency the same rules file discourages.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units… Format once, at the edge" | `merchant-console/CLAUDE.md` | Cents drift; a formatted string re-enters arithmetic |
| "One query builder… A second implementation is a defect, not a shortcut" | `merchant-console/CLAUDE.md`, ORG-STANDARDS #6 | Export and table disagree about what matches a filter |
| "Anything from the client — column names… — is checked against an allowlist before it reaches a query, a filename, or the store" | `merchant-console/CLAUDE.md`, ORG-STANDARDS #7 | Arbitrary client input reaches a response header |
| "Validate them server-side. Do not interpolate them into SQL" | Ticket, Notes | Injection via column names |
| "The payments table is paginated. Building this in the browser exports the current page only" | Ticket, Notes | Ships page 1 of N and calls it the feature |
| Card data is masked outside the single creation response | ORG-STANDARDS #8 | `last4` leaves in files it should not |

## Approach

Keep the whole flow server-side and keep the native download. The Export button becomes a client component that opens a dialog built on `Drawer` (the existing Radix dialog wrapper); the dialog collects column checkboxes and a scope choice, then navigates to the same `/api/payments/export` URL with `columns` and `scope` added as query params. The route validates every incoming column name against `EXPORT_COLUMNS`, reorders the selection into that canonical order so the file is predictable regardless of click order, drops filters entirely when `scope=all`, and rejects an empty selection. `toCsv` already takes the column list, so `csv.ts` changes only in `exportFilename`, which gains a scope token. Both row counts are computed by the existing server component — which already holds `total` from `queryPayments` — and passed to the dialog as props.

**Considered and rejected:** a POST with a JSON body and a client-side blob download. It reads cleaner and avoids a long URL, but it replaces the browser's native download with JS that has to build a Blob, synthesize an anchor, and revoke the object URL, and it puts filename handling in the client. The GET keeps the download path the browser already handles correctly and keeps the filename server-authored, which is where the allowlist lives.

**Also rejected:** fetching counts from a new `/api/payments/count` endpoint. `page.tsx` already computes `total` on the server for the pagination footer; a second endpoint would be a second path to the same number.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | `exportFilename` takes a scope token; add a column-name validator against `EXPORT_COLUMNS`. Do **not** touch `cell()` or `escapeCell()` |
| `src/lib/csv.test.ts` | Change | Extend — not replace — with cases for the validator and the new filename shapes |
| `src/app/api/payments/export/route.ts` | Change | Parse `columns` and `scope`, validate, reject empty, bypass filters when scope is all |
| `src/app/payments/export-dialog.tsx` | Add | Client component: column checkboxes, scope choice, row count, Download. Sits beside `filter-bar.tsx`, same pattern |
| `src/app/payments/page.tsx` | Change | Render the dialog in place of the bare `<a>`; pass filtered and unfiltered totals |

## Plan

1. **Filename and validator in `csv.ts`** — done when: `npm test -- src/lib/csv.test.ts` passes with new cases covering `payments-disputed-…`, `payments-filtered-…`, `payments-all-…`, and rejection of an unknown column name.
2. **Route accepts and validates `columns` and `scope`** — done when: `curl` with `?columns=id&columns=amount&scope=all` returns those two columns over every payment; an unknown column returns 400; no columns returns 400.
3. **Scope bypasses filters** — done when: `?status=disputed&scope=all` returns 1,658 rows, not 33.
4. **Dialog renders and drives the URL** — done when: clicking Export opens it, `last4` is unchecked, current filter is selected, and Download navigates to the composed URL.
5. **Row counts and the empty-selection guard** — done when: both counts show and switch with the scope toggle, and clearing every checkbox disables Download.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Columns choosable, `last4` off by default | Open the dialog — `last4` unchecked; download and confirm the header row omits it |
| Scope choice, current filter default, row count visible | With `status=disputed`: dialog shows 33 for current filter and 1,658 for all payments, before download |
| Filename reflects scope and date | `content-disposition` reads `payments-disputed-2026-08-25.csv`; unit test pins all three token cases |
| Minor units internally, formatted once, currency own column | Unchanged by this work — `cell()` already calls `formatMoney` at the edge and `currency` is already its own column. Existing `csv.test.ts` cases stay green as proof |
| Zero columns disables Download | Uncheck all — button disabled; the route also returns 400 if the URL is hand-edited |

## Risks

- **Header injection via the filename.** The scope token lands in a `content-disposition` header. It must come from the validated allowlist or the fixed set `disputed|filtered|all`, never from raw client input — a CRLF in a status param would otherwise forge headers.
- **Client-side disable is not enforcement.** The dialog disabling Download is UX; the route must independently reject an empty or unknown column list.
- **Existing tests pin cell formatting.** `csv.test.ts:32` and `:38` expect `$250.00` and `"$1,234,567.89"`. Changing how amounts are written breaks them and is out of scope.
- **Row count can go stale.** Counts are computed at page render and the store is mutable, so a long-open dialog could show a number that has since moved. Acceptable for an internal tool; worth stating in the PR.

## Out of scope

- Persistence of any kind — no database, no ORM, no migrations. That is NWP-203.
- `sortPayments` comparing amounts as strings (`queries.ts:81`), so `9000` sorts above `25000`. Real bug, affects table and export alike, belongs in its own ticket.
- Changing how a cell is written, including the currency symbol inside the `amount` column.
- Export formats other than CSV; scheduled or emailed exports.

## Open questions

- Does `scope=all` ignore the date range too, or only status/merchant/search? Assumed **all filters**, since "all payments" reads literally — worth one sentence of confirmation from Dana.
- Should the column selection persist between exports (localStorage) so ops does not re-uncheck `last4` every time? Not in the acceptance criteria; would remove most of the remaining manual effort. Candidate follow-up, not this ticket.
