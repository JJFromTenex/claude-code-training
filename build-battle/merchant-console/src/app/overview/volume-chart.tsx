"use client"

import { BarChart } from "@/components/BarChart"
import { DailyVolume } from "@/data/metrics"
import { Currency } from "@/data/types"
import { formatMoneyCompact } from "@/lib/money"

/** Chart rows are minor units; formatting happens once, in the value formatter. */
export function VolumeChart({
  data,
  currency,
}: {
  data: DailyVolume[]
  currency: Currency
}) {
  const rows = data.map((day) => ({
    date: day.date.slice(5),
    Captured: day.captured,
    Refunded: day.refunded,
  }))
  return (
    <BarChart
      className="mt-6 h-72"
      data={rows}
      index="date"
      categories={["Captured", "Refunded"]}
      colors={["blue", "gray"]}
      valueFormatter={(value: number) => formatMoneyCompact(value, currency)}
      yAxisWidth={64}
      showLegend
    />
  )
}
