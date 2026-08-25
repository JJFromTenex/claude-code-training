# EPIC · NWP-101 — Payments export: let ops choose columns and scope

> Written before any code. Generated with `/epic`, then edited by a human.
> Load it as context when you build: `@docs/epics/NWP-101-export-options.md`

**Ticket:** [NWP-101](../tickets/NWP-101.md)
**Author:** Jack Homer
**Status:** draft

## Problem

Dana's ops team exports the payments table several times a day, and every file comes out the same shape: every column, current filter only. The card last-four rides along in every file, so anything headed to a merchant gets hand-edited first — 3-4 hours a month, and a near-miss last quarter where an unedited file almost reached the wrong merchant.

## Current state

- `src/app/payments/page.tsx:68-76` — the Export button is a plain `<a href="/api/payments/export?{query}">`, where `query` is whatever the page's own filter params (`status`, `merchantId`, `search`) currently are. No dialog, no options.
- `src/app/api/payments/export/route.ts` — `GET` handler. Calls `parseFilters`, then `filterPayments` + `sortPayments`, then `toCsv(rows)` with no explicit column list, so it defaults to every `EXPORT_COLUMN`. **It already exports the full filtered set, unpaginated** — the "browser-built export only grabs the current page" risk the ticket warns about does not currently exist here, because the route never calls `paginate`.
- `src/lib/csv.ts` — `toCsv(payments, columns = EXPORT_COLUMNS)` already takes an optional column list and writes only those, in the order given (proven by the existing test `"writes only the requested columns, in the order given"` in `csv.test.ts:32`). The column-subset mechanism this ticket needs already exists; nothing here calls it with anything but the default.
- `src/lib/csv.ts:69-71` — `exportFilename(date = new Date())` always returns `payments-<date>.csv`. No scope or filter information in the name today.
- `src/data/queries.ts` — the one query builder. `filterPayments(filters)` treats every field on `PaymentFilters` as optional-and-skippable (`if (status && status !== "all" ...)`), so calling it with `{}` returns every payment, unfiltered — this is the mechanism an "all payments" scope needs, with no new function required.
- `src/app/api/payments/route.ts` — `GET /api/payments` returns `queryPayments(filters)`, whose shape is `{ rows, total, page, pageCount, pageSize }`. `total` is the filtered-but-unpaginated count. This route can be reused as-is to answer "how many rows will this export contain" without adding a counting endpoint.
- `src/components/` has no `Checkbox` or `RadioGroup` primitive, and neither `@radix-ui/react-checkbox` nor `@radix-ui/react-radio-group` is a dependency (`package.json`). It does have `Drawer.tsx`, built on `@radix-ui/react-dialog` (already a dependency), with header/body/footer parts and Escape-to-close, focus-trap behavior from Radix already wired up.
- The ticket says the export scope choice is "current filter or all payments." The filter fields exposed on `/payments` today are only `status`, `merchantId`, `search` (`filter-bar.tsx`) — no date range in the UI, even though `PaymentFilters`/`filterPayments` accept `from`/`to`.

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| Money is integer minor units, formatted once at the edge | `CLAUDE.md` convention 1 | Re-formatting a column downstream risks a second, drifting formatter |
| Every amount travels with its currency; format at the edge only | `.claude/rules/money.md` | `amount` and `currency` must stay separate columns, which `EXPORT_COLUMNS` already does — must not collapse them |
| Storage and bucketing are UTC; only display converts | `CLAUDE.md` convention 2 | A filename or filter based on local time would put a payment in the wrong day's file |
| One query builder; a second implementation is a defect | `CLAUDE.md` convention 3, ticket notes | Scope handling must go through `filterPayments`, not a hand-rolled filter in the route |
| Validate anything from the client against an allowlist before it reaches a query, a filename, or the store | `CLAUDE.md` convention 4, `.claude/rules/api-routes.md` | An unvalidated `columns` param is exactly the "don't interpolate into SQL" case the ticket calls out |
| Never return a full card number from a list/detail route | `.claude/rules/api-routes.md`, `.claude/rules/cards.md` | Not new risk here — export only ever carries `last4` — but the column picker must not add a full-PAN column |
| Card last-four off by default | Ticket acceptance criteria | An unedited export sent to a merchant leaks a card fragment, which is the near-miss that opened this ticket |
| Dialogs and forms must be operable: labeled inputs, accessible name, focus management, Escape closes | `.claude/rules/components.md` | An options dialog ops can't drive with a keyboard fails the ticket in spirit even if it passes the acceptance criteria |

## Approach

Add a client-side options dialog, built on the existing `Drawer` primitive, that replaces the plain `<a>` Export button on `/payments`. It holds a checkbox per `EXPORT_COLUMN` (all on except `last4`, which starts off) and a two-option scope radio (`Current filter`, default; `All payments`). Whenever scope or the current page filters change, it re-fetches the row count from the existing `GET /api/payments` (reading `total`, ignoring `rows`) so the count on screen is always real. Download is disabled whenever zero columns are checked. Submitting builds a `GET /api/payments/export` URL carrying the chosen `columns` (ordered, comma-separated) and `scope`, plus the page's current filters when scope is "current filter." The export route validates `columns` against the existing `EXPORT_COLUMNS` allowlist, resolves the effective filter set (`{}` for "all payments," the parsed filters otherwise — both go through the same `filterPayments`), and derives the filename from scope + active status + date.

**Considered and rejected:** building the CSV client-side from the already-fetched, already-paginated table rows. It's less code, but it silently reintroduces the "only the visible page" bug the ticket explicitly warns about the moment ops filters down to a smaller page size, and it duplicates the column-formatting logic that already lives in `csv.ts`. Reusing the server route keeps `toCsv` as the single place a cell gets formatted.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `src/lib/csv.ts` | Change | `exportFilename` needs a scope/status label parameter so the name can read `payments-disputed-2026-08-13.csv`; update the stale header comment that still calls the fixed column set/scope "today" |
| `src/lib/csv.test.ts` | Change | Extend with cases for the new `exportFilename` signature, per the ticket's Definition of Done |
| `src/app/api/payments/export/route.ts` | Change | Parse and allowlist-validate `columns`, parse `scope`, resolve effective filters (`{}` vs. parsed), pass both into `toCsv` and the new `exportFilename` |
| `src/app/payments/export-dialog.tsx` | Add | Client component: column checklist, scope radio, live row-count fetch against `GET /api/payments`, disables Download at zero columns, builds and navigates to the export URL |
| `src/app/payments/page.tsx` | Change | Swap the current `<a>` Export button for the new dialog trigger, passing today's filters and the merchant list through unchanged |

## Plan

1. **Extend `exportFilename` to accept a label, update its test** — done when: `npm test` passes with the new cases and the old `"stamps the UTC date"` case still holds with the label defaulted.
2. **Update the export route to parse/validate `columns` and `scope`** — done when: `curl "localhost:3000/api/payments/export?columns=id,amount"` returns a two-column CSV for every payment regardless of the page's own filters, and a request with an unknown column name (e.g. `columns=id,nope`) drops the unknown one rather than erroring on a valid remainder; an all-invalid list returns `400` with the same error shape other routes use.
3. **Build `export-dialog.tsx`** — done when: opening it shows every column checked except `last4`, scope defaults to "Current filter" with a live row count, and unchecking every column disables Download.
4. **Wire the dialog into `payments/page.tsx`** in place of the current `<a>` — done when: the page renders the trigger, and leaving every dialog option at its default reproduces today's export (minus `last4`) byte-for-byte for the same filters.
5. **Run `npm test`, then `/ship-ready`** — done when both are clean.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| Ops can choose columns; `last4` off by default | Browser click-through: open dialog, confirm `last4` unchecked, toggle others, inspect the downloaded file's header row |
| Scope: current filter (default) or all payments; row count visible before download | Browser click-through: switch scope with an active status filter, watch the count change, compare to `GET /api/payments?status=<x>` `total` |
| Filename reflects scope and date | Unit test on `exportFilename` in `csv.test.ts`; confirmed against a real download's `content-disposition` header |
| Amounts stay in minor units internally, formatted once, currency in its own column | Already covered by the existing `toCsv` tests; confirmed no new formatting call is added outside `cell()` |
| Deselecting every column disables Download | Browser click-through: uncheck all, confirm the Download button is disabled, not merely no-op |
| Unit test covers the column serializer; `npm test` passes | `npm test` output pasted into the PR description |

## Risks

- Re-fetching the row count on every scope/filter change could feel laggy on a slow connection; acceptable for now since it's one lightweight `GET`, but worth a loading state (`Skeleton` component already exists) rather than a stale number.
- The dialog builds its own query string from the page's current filters; if `filter-bar.tsx` ever adds a new filter field, this dialog has to be updated in step, or exports will silently stop honoring it. Noting this rather than solving it here.
- A hand-crafted request with an empty or fully-invalid `columns` list needs a defined server response (400) even though the UI itself prevents it — decided here rather than left as a gap.

## Out of scope

- Date-range (`from`/`to`) filtering — not exposed anywhere in the current `/payments` UI; not adding date pickers for this ticket.
- Persisting a chosen column set between sessions — the store is in-memory only (persistence is NWP-203), and the ticket doesn't ask for it.
- NWP-201 (virtual cards) — unrelated ticket, not touched by this change.
- A new `Checkbox`/`RadioGroup` component in `src/components/` — plain labeled `<input type="checkbox">`/`<input type="radio">` elements satisfy the accessibility rule in `components.md` without adding a Radix dependency that isn't already installed.

## Open questions

- The ticket's one filename example (`payments-disputed-2026-08-13.csv`) only shows a status-driven label. This plan derives the label from status + scope only, and ignores `merchantId`/`search` for naming purposes — flagging in case ops actually wants those reflected too.
- Whether "all payments" scope should still respect a status filter the user had active on the page, or truly mean every payment regardless. This plan takes it literally: "all payments" ignores every filter, including status; "current filter" is the only scope that honors them.
