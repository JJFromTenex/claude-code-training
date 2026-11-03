# SPEC · NWP-102 — Daily volume buckets in UTC and sums in minor units

> Written before any code. Generated with `/spec`, then edited by a human.
> Load it as context when you build: `@docs/specs/NWP-102-utc-daily-volume.md`

**Ticket:** [NWP-102](../tickets/NWP-102.md)
**Author:** Jason Xu (with Claude Code)
**Status:** building

## Problem

Merchants say the overview's daily volume does not match their settlement statement. The Berlin merchant sees a whole day of volume on the wrong date, and two others are a few cents off on high-volume days, with the gap growing as transaction count grows. Support cannot reproduce it reliably, because the date error depends on the timezone of the machine serving the console.

## Current state

- `build-battle/merchant-console/src/data/metrics.ts:17` — `dailyVolume(days)` builds bucket keys with `lastUtcDays` (UTC), then buckets each payment with `new Date(payment.createdAt).toLocaleDateString("en-CA")` (line 25). That is the **server's local** calendar day, so any payment near midnight UTC lands a day early or late, or falls outside the window and is dropped, whenever the process is not running in UTC.
- `src/data/metrics.ts:31-34, 42-43` — amounts are accumulated as floats in major units (`payment.amount / 100`) and rounded back with `Math.round(x * 100)` at the end. Float error accumulates per payment, which matches "grows with transaction count".
- `src/lib/dates.ts` — `utcDayKey(iso)` already returns the UTC calendar day of a stored instant. It is the helper `dailyVolume` should have used.
- `src/lib/money.ts` — `sumMinorUnits(amounts)` already sums integer minor units.
- `src/app/overview/page.tsx:12` — the only caller of `dailyVolume`.
- `src/lib/dates.test.ts` — already documents that mixing UTC bucketing with local display gives "a total that is quietly wrong near midnight".

## Domain rules

| Rule | Source | What breaks if ignored |
| --- | --- | --- |
| "Money is integer minor units." | `build-battle/merchant-console/CLAUDE.md` | Cents drift on every total |
| "Never store, compare, or accumulate an amount as a float." | `.claude/rules/money.md` | Totals off by cents on busy days |
| "Storage and bucketing are UTC. Display converts to the merchant's timezone. Nothing else does." | `build-battle/merchant-console/CLAUDE.md` | Whole days shift depending on server TZ |
| "Read before you edit. A second implementation of an existing helper is a defect." | `CLAUDE.md` | Two date/money helpers that disagree |
| "Never edit seed data to make a failing case disappear." | `CLAUDE.md` | The bug hides instead of being fixed |

## Approach

In `dailyVolume`, replace the local-time bucket key with `utcDayKey(payment.createdAt)`, and collect each bucket's amounts as integer minor units, totalled with `sumMinorUnits`. Drop the `/ 100` and `Math.round(* 100)` round-trip entirely. To make the function testable without touching the seed, it takes an optional `payments` argument that defaults to `store.payments`, and an optional `now` that defaults to `GENERATED_AT`; the overview call site does not change.

**Considered and rejected:** keeping the float accumulation and rounding more carefully (e.g. rounding per payment). It still breaks the integer-minor-units rule and only hides the drift. Also rejected: bucketing by the merchant's timezone with `dayKeyInZone`. The codebase rule is that bucketing is UTC and only display converts, and the overview is a cross-merchant ops screen with no single merchant timezone.

## File map

| File | Add or change | Why |
| --- | --- | --- |
| `build-battle/merchant-console/src/data/metrics.ts` | Change | UTC bucketing via `utcDayKey`, integer sums via `sumMinorUnits`, injectable `payments`/`now` |
| `build-battle/merchant-console/src/data/metrics.test.ts` | Add | Regression tests for midnight bucketing under a non-UTC `TZ` and for exact integer sums |

## Plan

1. **Write failing tests** — done when: a 23:30 UTC payment run under `TZ=America/Los_Angeles` and a many-payment integer sum both fail against the current code.
2. **Fix `dailyVolume`** — done when: both tests pass and the overview call site is unchanged.
3. **Run `npm test`** — done when: the whole suite is green.

## Verification

| Acceptance criterion | How it is proven |
| --- | --- |
| A payment lands on its UTC day regardless of server timezone | `metrics.test.ts`: payments at 23:30 and 00:15 UTC with `process.env.TZ = "America/Los_Angeles"` land on their UTC dates |
| Totals are exact integer minor units | `metrics.test.ts`: many payments whose float sum drifts sum to the exact integer, and every returned amount is an integer |
| Nothing else regresses | `npm test` |

## Risks

- Node caches the local timezone; setting `process.env.TZ` inside a test may not take effect everywhere. Mitigation: set it at the top of the test file before any `Date` use, and assert the precondition (`new Date("…T23:30Z").getDate()` differs from the UTC date) so the test cannot pass vacuously.

## Out of scope

These are other plausible causes of the reports in NWP-102, found while reading. They have different root causes and get their own fixes:

- **Refunds counted at the full payment amount.** `dailyVolume` and `headlineMetrics` add `payment.amount` for refunded payments, but `src/data/generate.ts:112` creates partial refunds (`Math.floor(amount / 2)`), and refunds are dated by the refund, not the payment. Likely the "refund-heavy merchant sees totals too high" report.
- **Summing across currencies.** `src/data/metrics.ts` sums USD, EUR and GBP amounts together while its header claims USD. Possibly part of the Berlin (EUR) merchant's mismatch.
- **`headlineMetrics` gross volume adds refunded to captured.** Needs a product decision on what "gross volume" means.
- **Payouts vs payments agreement**, which the ticket says nobody has checked.

## Open questions

- Is the Berlin merchant's "wrong date" entirely the server-TZ bug, or do they also expect their statement in Europe/Berlin days? If the latter, that is a display change, not a bucketing change.
