import { lastUtcDays, utcDayKey } from "@/lib/dates"
import { sumMinorUnits } from "@/lib/money"
import { filterPayments } from "./queries"
import { GENERATED_AT } from "./generate"
import { store } from "./store"
import { CURRENCIES, Currency } from "./types"

/**
 * Dashboard metrics. Merchants carry USD, EUR, and GBP, and this codebase has
 * no FX rate source, so every money figure here is bucketed per currency
 * rather than summed across them. Summing across currencies produces a
 * number that looks plausible while being meaningless.
 */

/** A zeroed per-currency bucket so every currency key is present, even at zero. */
function zeroPerCurrency(): Record<Currency, number> {
  return Object.fromEntries(CURRENCIES.map((c) => [c, 0])) as Record<
    Currency,
    number
  >
}

/** Group amounts by currency, then sum each group with sumMinorUnits. */
function sumByCurrency(
  items: { amount: number; currency: Currency }[],
): Record<Currency, number> {
  const grouped = new Map<Currency, number[]>(
    CURRENCIES.map((c) => [c, [] as number[]]),
  )
  for (const item of items) {
    grouped.get(item.currency)!.push(item.amount)
  }

  const totals = zeroPerCurrency()
  for (const currency of CURRENCIES) {
    totals[currency] = sumMinorUnits(grouped.get(currency)!)
  }
  return totals
}

export interface DailyVolume {
  date: string
  /** Integer minor units, keyed by currency. Every currency is present, zero when idle. */
  captured: Record<Currency, number>
  /** Integer minor units, keyed by currency. Every currency is present, zero when idle. */
  refunded: Record<Currency, number>
}

export function dailyVolume(days = 30): DailyVolume[] {
  const keys = lastUtcDays(days, GENERATED_AT)
  const buckets = new Map<string, DailyVolume>(
    keys.map((date) => [
      date,
      { date, captured: zeroPerCurrency(), refunded: zeroPerCurrency() },
    ]),
  )

  for (const payment of store.payments) {
    // Bucket by UTC calendar day, matching the keys from lastUtcDays.
    const key = utcDayKey(payment.createdAt)
    const bucket = buckets.get(key)
    if (!bucket) continue

    if (payment.status === "captured") {
      // Minor units all the way through, grouped by currency so a USD and a
      // EUR payment never land in the same number.
      bucket.captured[payment.currency] += payment.amount
    }
    if (payment.status === "refunded") {
      bucket.refunded[payment.currency] += payment.amount
    }
  }

  return keys.map((date) => buckets.get(date)!)
}

export function headlineMetrics() {
  const captured = filterPayments({ status: "captured" })
  const refunded = filterPayments({ status: "refunded" })

  // Gross volume is everything that moved through the platform, per currency.
  const grossVolume = sumByCurrency([...captured, ...refunded])

  const authorized = store.payments.filter(
    (p) => p.status !== "failed",
  ).length
  const authRate = store.payments.length
    ? authorized / store.payments.length
    : 0

  const openDisputes = store.disputes.filter(
    (d) => d.status === "needs_response" || d.status === "under_review",
  )

  return {
    grossVolume,
    authRate,
    paymentCount: store.payments.length,
    openDisputes: openDisputes.length,
    disputedAmount: sumByCurrency(openDisputes),
  }
}
