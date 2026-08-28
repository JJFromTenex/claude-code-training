"use client"

import { BarChart } from "@/components/BarChart"
import { CURRENCIES, Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"

interface VolumeDay {
  date: string
  captured: Record<Currency, number>
  refunded: Record<Currency, number>
}

/**
 * Tremor's BarChart takes a single valueFormatter for the whole chart, which
 * cannot carry a different currency symbol per series. Since a payment is
 * always exactly one currency, the cleanest fix is one chart per currency
 * that actually has activity, each closed over its own formatter.
 */
export function VolumeChart({ data }: { data: VolumeDay[] }) {
  const present = CURRENCIES.filter((currency) =>
    data.some((day) => day.captured[currency] !== 0 || day.refunded[currency] !== 0),
  )

  if (present.length === 0) {
    return (
      <p className="mt-6 text-sm text-gray-500">
        No captured or refunded volume in this period.
      </p>
    )
  }

  return (
    <div className="mt-6 space-y-8">
      {present.map((currency) => (
        <div key={currency}>
          {present.length > 1 && (
            <h3 className="text-xs font-medium text-gray-500">{currency}</h3>
          )}
          <BarChart
            className="mt-2 h-72"
            data={data.map((day) => ({
              date: day.date,
              Captured: day.captured[currency],
              Refunded: day.refunded[currency],
            }))}
            index="date"
            categories={["Captured", "Refunded"]}
            colors={["blue", "gray"]}
            valueFormatter={(value: number) => formatMoney(value, currency)}
            yAxisWidth={64}
            showLegend
          />
        </div>
      ))}
    </div>
  )
}
