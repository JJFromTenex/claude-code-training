import { sumMinorUnits } from "@/lib/money"
import { GENERATED_AT } from "./generate"
import { merchants } from "./merchants"
import { store } from "./store"
import { CURRENCIES, Currency } from "./types"

/**
 * Weekly rollups for the monitoring dashboard. Buckets are UTC weeks ending
 * on the generation date, oldest first.
 */

const WEEK_MS = 7 * 86_400_000

export interface WeekBucket {
  date: string
  start: number
  end: number
}

export function weeks(count = 12): WeekBucket[] {
  const buckets: WeekBucket[] = []
  const anchor = GENERATED_AT.getTime()
  for (let i = count - 1; i >= 0; i--) {
    const end = anchor - i * WEEK_MS
    const start = end - WEEK_MS
    buckets.push({
      date: new Intl.DateTimeFormat("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
      }).format(new Date(start)),
      start,
      end,
    })
  }
  return buckets
}

const inWeek = (iso: string, week: WeekBucket) => {
  const at = new Date(iso).getTime()
  return at >= week.start && at < week.end
}

export interface WeeklyVolumeByCurrency {
  currency: Currency
  data: { date: string; "This period": number; "Previous period": number }[]
}

/**
 * Captured volume this period against the period before it, per currency.
 * Integer minor units — rounding and formatting happen in the chart, not here.
 */
export function volumeByWeek(count = 12): WeeklyVolumeByCurrency[] {
  const current = weeks(count)

  const sum = (bucket: WeekBucket, currency: Currency) =>
    sumMinorUnits(
      store.payments
        .filter(
          (p) =>
            p.status === "captured" &&
            p.currency === currency &&
            inWeek(p.createdAt, bucket),
        )
        .map((p) => p.amount),
    )

  return CURRENCIES.map((currency) => ({
    currency,
    data: current.map((week) => {
      const previous: WeekBucket = {
        ...week,
        start: week.start - count * WEEK_MS,
        end: week.end - count * WEEK_MS,
      }
      return {
        date: week.date,
        "This period": sum(week, currency),
        "Previous period": sum(previous, currency),
      }
    }),
  }))
}

export interface WeeklyCountAndVolume {
  currency: Currency
  data: { date: string; Payments: number; "Captured volume": number }[]
}

/**
 * Payment count against captured volume, for the biaxial chart. Payments is
 * a count and stays global; captured volume is money and is split per
 * currency so it is never added across currencies.
 */
export function countAndVolumeByWeek(count = 12): WeeklyCountAndVolume[] {
  const buckets = weeks(count)

  return CURRENCIES.map((currency) => ({
    currency,
    data: buckets.map((week) => {
      const inBucket = store.payments.filter((p) => inWeek(p.createdAt, week))
      const captured = inBucket.filter(
        (p) => p.status === "captured" && p.currency === currency,
      )
      return {
        date: week.date,
        Payments: inBucket.length,
        "Captured volume": sumMinorUnits(captured.map((p) => p.amount)),
      }
    }),
  }))
}

/** Approved against failed, rendered as a percentage stack. */
export function authorizationByWeek(count = 12) {
  return weeks(count).map((week) => {
    const inBucket = store.payments.filter((p) => inWeek(p.createdAt, week))
    return {
      date: week.date,
      Approved: inBucket.filter((p) => p.status !== "failed").length,
      Failed: inBucket.filter((p) => p.status === "failed").length,
    }
  })
}

/** Share of payments that ended in a dispute, per week. */
export function disputeRateByWeek(count = 12) {
  return weeks(count).map((week) => {
    const inBucket = store.payments.filter((p) => inWeek(p.createdAt, week))
    const disputed = inBucket.filter((p) => p.status === "disputed").length
    return {
      date: week.date,
      "Dispute rate": inBucket.length ? disputed / inBucket.length : 0,
    }
  })
}

/** Per-merchant rollup for the merchants tab. */
export function merchantRollup() {
  const rollups = merchants.map((merchant) => {
    const payments = store.payments.filter((p) => p.merchantId === merchant.id)
    const captured = payments.filter((p) => p.status === "captured")
    const disputes = store.disputes.filter((d) => d.merchantId === merchant.id)
    const failed = payments.filter((p) => p.status === "failed").length

    return {
      merchant,
      payments: payments.length,
      // Single currency per merchant, so this sum is honest on its own.
      volume: sumMinorUnits(captured.map((p) => p.amount)),
      disputes: disputes.length,
      authRate: payments.length
        ? (payments.length - failed) / payments.length
        : 0,
    }
  })

  // Sorting all merchants by raw volume would rank a EUR total against a
  // GBP total as if they were the same unit, and there is no FX rate here to
  // make that comparison honest. Rank within each currency instead, then
  // list currency groups in a fixed order — merchants are only ever compared
  // against others who share their currency.
  return CURRENCIES.flatMap((currency) =>
    rollups
      .filter((r) => r.merchant.currency === currency)
      .sort((a, b) => b.volume - a.volume),
  )
}
