# DIAGNOSIS · NWP-102 — Merchants say yesterday's totals are wrong

> Written before any code, as the ticket requires. No fix is proposed here beyond
> naming the cause of each report.

**Ticket:** [NWP-102](../tickets/NWP-102.md)
**Status:** reviewed

## Answer up front

Three reports, **three different root causes**, all in one file: `src/data/metrics.ts`. They do not share a cause, which is why support could not find a single reproduction.

A fourth defect sits in the same function and nobody has reported it yet.

| Report | Root cause | Where |
| --- | --- | --- |
| Berlin merchant sees a whole day on the wrong date | Bucketing by the server's local day against keys built in UTC | `metrics.ts:25` |
| Two merchants off by a few cents, growing with transaction count | Money accumulated as a float in major units | `metrics.ts:31,34,42,43` |
| Heavy-refund merchant sees totals **too high** | Refunds counted at the original payment amount, not the amount actually refunded | `metrics.ts:32-35` |
| *(unreported)* every merchant's headline figure | USD, GBP and EUR summed without conversion | `metrics.ts:23,49-55` |

## Files involved

- `src/data/metrics.ts` — `dailyVolume()` and `headlineMetrics()`. Every defect below is here.
- `src/lib/dates.ts` — has `utcDayKey()`, which does correctly what `metrics.ts:25` does by hand.
- `src/lib/money.ts` — has `sumMinorUnits()`, unused by `metrics.ts`.
- `src/data/store.ts` — holds `store.refunds`, which `metrics.ts` never reads.
- `src/data/generate.ts` — the seed generator; it is where the refund shape and the merchant currencies are decided. Not a defect, but it explains the data.
- `src/app/overview/page.tsx:16-17` — the only consumer. Divides by 100 for the chart, so `dailyVolume` returns minor units.

## Cause 1 — the Berlin merchant, a day on the wrong date

`dailyVolume()` builds its buckets from `lastUtcDays()` (`metrics.ts:18`), which returns **UTC** day keys. It then looks each payment up by a **local** day key:

```ts
const key = new Date(payment.createdAt).toLocaleDateString("en-CA")   // metrics.ts:25
```

`toLocaleDateString` follows the server's timezone. The two agree only when the server runs on UTC.

`src/data/merchants.ts:5` says the quiet part out loud — *"Berlin and London exist so timezone bugs have somewhere to show up."* Berlin is `Europe/Berlin`, currency EUR; the three US merchants are the ones not complaining.

The money is not lost, it is **shifted to the adjacent bucket**, which is why the day totals move but the 30-day total does not. That is also why a test summing the whole window passes while the bug is live — verified: a grand-total assertion stayed green against the broken code, and only a day-by-day comparison went red.

On this machine (`America/Toronto`, UTC−4) every payment between 00:00 and 04:00 UTC lands one day early.

## Cause 2 — a few cents, growing with volume

```ts
bucket.captured += payment.amount / 100          // metrics.ts:31
...
captured: Math.round(bucket.captured * 100),     // metrics.ts:42
```

Amounts are converted to major units, accumulated as floats, and rounded back. `CLAUDE.md` and `.claude/rules/money.md` both forbid this: *"Never store, compare, or accumulate an amount as a float."*

`Math.round` hides drift below half a cent, so low-volume days look fine. The error compounds with each addition, which matches the ticket's observation that the discrepancy grows with transaction count. `sumMinorUnits()` in `src/lib/money.ts:41` exists for exactly this and is unused.

## Cause 3 — the heavy-refund merchant, totals too high

```ts
if (payment.status === "refunded") {
  bucket.refunded += payment.amount              // metrics.ts:34
}
```

This counts the **original payment amount** as the refunded amount. But refunds are their own records, and they are not all full:

```ts
const full = rand() < 0.7
refunds.push({ amount: full ? amount : Math.floor(amount / 2), ... })   // generate.ts:108-112
```

Roughly **30% of refunds are partial**, at half the payment. For those, the dashboard reports double what was actually refunded. A merchant with heavy refund activity accumulates that overstatement, and their refunded column reads high — exactly the report.

`store.refunds` holds the real amounts and `metrics.ts` never reads it. `refundsForPayment()` in `src/data/queries.ts:113` is the existing accessor.

**A second error rides along here.** The refund is bucketed on the *payment's* date, but refunds are generated 1 to 6 days later (`generate.ts:119-121`). Even a full refund is therefore attributed to the wrong day. This one has not been reported separately, but it will land on the same merchant.

## Cause 4 — currencies summed together (not yet reported)

Every merchant's payments carry the merchant's own currency (`generate.ts:96`), and the roster is USD, GBP and EUR (`merchants.ts`). `dailyVolume()` iterates all payments into one bucket, and `headlineMetrics()` sums `grossVolume` across every merchant, then the overview renders it as USD (`overview/page.tsx`, `formatMoneyCompact(metrics.grossVolume, "USD")`).

`.claude/rules/money.md`: *"Every amount travels with its currency code. Summing across currencies without converting is a bug even when the number looks right."*

Nobody has reported this because the number is plausible and no merchant sees the platform-wide figure. It is the largest error of the four.

## Payouts vs payments

The ticket asks whether the payouts screen agrees with payments. **Payouts is correct and the dashboard is not.**

`generate.ts:158-184` computes each payout per merchant — therefore in one currency — comparing ISO timestamps directly, which is a UTC comparison, and keeps integer minor units throughout with `net = gross - fees`. It has none of the four defects above.

Payouts is the trustworthy figure to reconcile a merchant against while the dashboard is wrong.

## What would prove a fix

A day-by-day comparison, not a total. During this diagnosis a whole-window sum was written first and passed against the broken code; it proved nothing. The assertion that discriminates is each UTC day's captured and refunded totals against the same figures computed straight off the store.

Cause 2 needs its own check: `Math.round` returns an integer either way, so an "is it an integer" assertion does not catch float drift. The day-by-day comparison does, once the expected side accumulates in minor units.

## Out of scope

No fix is proposed here. The ticket asks for the diagnosis first and says so explicitly:

> Do not fix it in the same session that finds it. Read first.

Causes 1 and 2 have a candidate fix parked on this branch as a separate commit, written before this document existed and deliberately not merged into the NWP-101 work. It does not address causes 3 or 4.

## Open questions

- Is "gross volume" meant to include refunded payments at all? `metrics.ts:52` calls it *"everything that moved through the platform"*, which is defensible, but a merchant reconciling against a settlement statement expects refunds to reduce it. This is a product question, not a code one.
- What conversion rate should cause 4 use, and as of when? Converting at display time and converting at bucketing time give different answers on a moving rate.
- Should the refunded column follow the refund's date or the original payment's date? Both are defensible; they are different reports.
