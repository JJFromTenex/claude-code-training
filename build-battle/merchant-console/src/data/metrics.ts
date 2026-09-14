import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { sumMinorUnits } from "@/lib/money"
import { GENERATED_AT } from "./generate"
import { store } from "./store"
import { Currency, Dispute, Payment, Refund } from "./types"

/**
 * Dashboard metrics. Every figure is integer minor units and travels with
 * its currency: totals are grouped by currency, never summed across them.
 * Bucketing is by UTC calendar day, the same keys `lastUtcDays` produces.
 */

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export interface DailyVolume {
  date: string
  captured: number
  refunded: number
}

/**
 * Captured and refunded volume per UTC day for one currency. Amounts stay in
 * integer minor units the whole way; nothing is divided or rounded here.
 */
export function dailyVolumeFor(
  payments: Payment[],
  keys: string[],
  currency: Currency,
): DailyVolume[] {
  const buckets = new Map<string, DailyVolume>(
    keys.map((date) => [date, { date, captured: 0, refunded: 0 }]),
  )

  for (const payment of payments) {
    if (payment.currency !== currency) continue
    const bucket = buckets.get(utcDayKey(payment.createdAt))
    if (!bucket) continue

    if (payment.status === "captured") bucket.captured += payment.amount
    if (payment.status === "refunded") bucket.refunded += payment.amount
  }

  return keys.map((date) => buckets.get(date)!)
}

export function dailyVolume(days = 30, currency: Currency = "USD"): DailyVolume[] {
  return dailyVolumeFor(store.payments, lastUtcDays(days, GENERATED_AT), currency)
}

export interface VolumeByCurrency {
  currency: Currency
  /** Everything charged: captured payments plus payments later refunded. */
  gross: number
  /** Money returned, from the refund records themselves so partial refunds count once. */
  refunded: number
  /** gross - refunded. Derived, never computed separately. */
  net: number
}

export function volumeByCurrency(payments: Payment[], refunds: Refund[]): VolumeByCurrency[] {
  return CURRENCIES.map((currency) => {
    const charged = payments.filter(
      (p) => p.currency === currency && (p.status === "captured" || p.status === "refunded"),
    )
    const gross = sumMinorUnits(charged.map((p) => p.amount))
    const refunded = sumMinorUnits(
      refunds.filter((r) => r.currency === currency).map((r) => r.amount),
    )
    return { currency, gross, refunded, net: gross - refunded }
  })
}

export function headlineMetricsFor(payments: Payment[], refunds: Refund[], disputes: Dispute[]) {
  const authorized = payments.filter((p) => p.status !== "failed").length
  const authRate = payments.length ? authorized / payments.length : 0

  const openDisputes = disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    volume: volumeByCurrency(payments, refunds),
    authRate,
    paymentCount: payments.length,
    openDisputes: openDisputes.length,
    disputedByCurrency: CURRENCIES.map((currency) => ({
      currency,
      amount: sumMinorUnits(
        openDisputes.filter((d) => d.currency === currency).map((d) => d.amount),
      ),
    })),
  }
}

export function headlineMetrics() {
  return headlineMetricsFor(store.payments, store.refunds, store.disputes)
}
