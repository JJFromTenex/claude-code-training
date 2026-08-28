"use client"

import { BarChart } from "@/components/BarChart"
import { ComboChart } from "@/components/ComboChart"
import { ConditionalBarChart } from "@/components/ConditionalBarChart"
import type { WeeklyCountAndVolume, WeeklyVolumeByCurrency } from "@/data/analytics"
import { formatMoney } from "@/lib/money"
import { formatters } from "@/lib/utils"

/**
 * Both charts below carry money for more than one currency. Tremor's chart
 * components take a single valueFormatter for the whole chart, so each
 * currency gets its own chart rather than one chart mislabeling every
 * series with the same symbol.
 */

export function VolumeByWeek({ data }: { data: WeeklyVolumeByCurrency[] }) {
  const present = data.filter((series) =>
    series.data.some((week) => week["This period"] !== 0 || week["Previous period"] !== 0),
  )

  if (present.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">No captured volume in this period.</p>
  }

  return (
    <>
      {present.map(({ currency, data: weekly }) => {
        const money = (value: number) => formatMoney(value, currency)
        return (
          <div key={currency}>
            {present.length > 1 && (
              <h4 className="mt-4 text-xs font-medium text-gray-500">{currency}</h4>
            )}
            <BarChart
              data={weekly}
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
              data={weekly}
              index="date"
              categories={["This period", "Previous period"]}
              colors={["blue", "lightGray"]}
              showYAxis={false}
              barCategoryGap="20%"
              valueFormatter={money}
              className="mt-4 h-60 md:hidden"
            />
          </div>
        )
      })}
    </>
  )
}

export function CountAndVolume({ data }: { data: WeeklyCountAndVolume[] }) {
  const present = data.filter((series) =>
    series.data.some((week) => week["Captured volume"] !== 0),
  )

  if (present.length === 0) {
    return <p className="mt-4 text-sm text-gray-500">No captured volume in this period.</p>
  }

  return (
    <>
      {present.map(({ currency, data: weekly }) => {
        const money = (value: number) => formatMoney(value, currency)
        return (
          <div key={currency}>
            {present.length > 1 && (
              <h4 className="mt-4 text-xs font-medium text-gray-500">{currency}</h4>
            )}
            <ComboChart
              data={weekly}
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
              data={weekly}
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
          </div>
        )
      })}
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
