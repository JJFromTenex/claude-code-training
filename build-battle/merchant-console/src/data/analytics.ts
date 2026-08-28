import { sumMinorUnits } from "@/lib/money"
import { GENERATED_AT } from "./generate"
import { merchants } from "./merchants"
import { store } from "./store"

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

/** Captured volume this period against the period before it. */
export function volumeByWeek(count = 12) {
  const current = weeks(count)
  return current.map((week) => {
    const previous: WeekBucket = {
      ...week,
      start: week.start - count * WEEK_MS,
      end: week.end - count * WEEK_MS,
    }
    const sum = (bucket: WeekBucket) =>
      sumMinorUnits(
        store.payments
          .filter((p) => p.status === "captured" && inWeek(p.createdAt, bucket))
          .map((p) => p.amount),
      )

    return {
      date: week.date,
      "This period": Math.round(sum(week) / 100),
      "Previous period": Math.round(sum(previous) / 100),
    }
  })
}

/** Payment count against captured volume, for the biaxial chart. */
export function countAndVolumeByWeek(count = 12) {
  return weeks(count).map((week) => {
    const inBucket = store.payments.filter((p) => inWeek(p.createdAt, week))
    const captured = inBucket.filter((p) => p.status === "captured")
    return {
      date: week.date,
      Payments: inBucket.length,
      "Captured volume": Math.round(
        sumMinorUnits(captured.map((p) => p.amount)) / 100,
      ),
    }
  })
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
  return merchants
    .map((merchant) => {
      const payments = store.payments.filter(
        (p) => p.merchantId === merchant.id,
      )
      const captured = payments.filter((p) => p.status === "captured")
      const disputes = store.disputes.filter(
        (d) => d.merchantId === merchant.id,
      )
      const failed = payments.filter((p) => p.status === "failed").length

      return {
        merchant,
        payments: payments.length,
        volume: captured.reduce((total, p) => total + p.amount, 0),
        disputes: disputes.length,
        authRate: payments.length
          ? (payments.length - failed) / payments.length
          : 0,
      }
    })
    .sort((a, b) => b.volume - a.volume)
}
