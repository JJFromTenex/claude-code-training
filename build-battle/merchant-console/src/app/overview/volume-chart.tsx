"use client"

import { BarChart } from "@/components/BarChart"

export function VolumeChart({
  data,
}: {
  data: { date: string; Captured: number; Refunded: number }[]
}) {
  return (
    <BarChart
      className="mt-6 h-72"
      data={data}
      index="date"
      categories={["Captured", "Refunded"]}
      colors={["blue", "gray"]}
      valueFormatter={(minorUnits: number) =>
        `$${(minorUnits / 100).toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}`
      }
      yAxisWidth={64}
      showLegend
    />
  )
}
