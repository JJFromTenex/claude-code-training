"use client"

import { BarChart } from "@/components/BarChart"
import { ComboChart } from "@/components/ComboChart"
import { ConditionalBarChart } from "@/components/ConditionalBarChart"
import { formatters } from "@/lib/utils"

/** Values arrive as integer minor units. This is the edge that converts them. */
const money = (minorUnits: number) =>
  formatters.currency({ number: minorUnits / 100, maxFractionDigits: 0 })

export function VolumeByWeek({ data }: { data: Record<string, any>[] }) {
  return (
    <>
      <BarChart
        data={data}
        index="date"
        categories={["This period", "Previous period"]}
        colors={["blue", "lightGray"]}
        yAxisWidth={64}
        yAxisLabel="Captured volume"
        barCategoryGap="20%"
        valueFormatter={money}
        className="mt-4 hidden h-60 md:block"
      />
      <BarChart
        data={data}
        index="date"
        categories={["This period", "Previous period"]}
        colors={["blue", "lightGray"]}
        showYAxis={false}
        barCategoryGap="20%"
        valueFormatter={money}
        className="mt-4 h-60 md:hidden"
      />
    </>
  )
}

export function CountAndVolume({ data }: { data: Record<string, any>[] }) {
  return (
    <>
      <ComboChart
        data={data}
        index="date"
        enableBiaxial
        barSeries={{
          categories: ["Payments"],
          yAxisLabel: "Payments / captured volume",
        }}
        lineSeries={{
          categories: ["Captured volume"],
          colors: ["lightGray"],
          showYAxis: false,
          valueFormatter: money,
        }}
        className="mt-4 hidden h-60 md:block"
      />
      <ComboChart
        data={data}
        index="date"
        enableBiaxial
        barSeries={{ categories: ["Payments"], showYAxis: false }}
        lineSeries={{
          categories: ["Captured volume"],
          colors: ["lightGray"],
          showYAxis: false,
          valueFormatter: money,
        }}
        className="mt-4 h-60 md:hidden"
      />
    </>
  )
}

export function AuthorizationMix({ data }: { data: Record<string, any>[] }) {
  return (
    <>
      <BarChart
        data={data}
        index="date"
        categories={["Approved", "Failed"]}
        colors={["emerald", "lightEmerald"]}
        type="percent"
        yAxisWidth={55}
        yAxisLabel="% of attempts approved"
        barCategoryGap="30%"
        className="mt-4 hidden h-60 md:block"
      />
      <BarChart
        data={data}
        index="date"
        categories={["Approved", "Failed"]}
        colors={["emerald", "lightEmerald"]}
        type="percent"
        showYAxis={false}
        barCategoryGap="30%"
        className="mt-4 h-60 md:hidden"
      />
    </>
  )
}

export function DisputeRate({ data }: { data: Record<string, any>[] }) {
  const percentage = (value: number) =>
    formatters.percentage({ number: value, decimals: 1 })
  return (
    <>
      <ConditionalBarChart
        data={data}
        index="date"
        categories={["Dispute rate"]}
        colors={["orange"]}
        valueFormatter={percentage}
        yAxisWidth={55}
        yAxisLabel="Disputed share of payments"
        barCategoryGap="30%"
        className="mt-4 hidden h-60 md:block"
      />
      <ConditionalBarChart
        data={data}
        index="date"
        categories={["Dispute rate"]}
        colors={["orange"]}
        valueFormatter={percentage}
        showYAxis={false}
        barCategoryGap="30%"
        className="mt-4 h-60 md:hidden"
      />
    </>
  )
}
