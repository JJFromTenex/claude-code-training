import { headlineMetrics } from "@/data/metrics"
import { filterPayments } from "@/data/queries"
import { store } from "@/data/store"

type Category = "red" | "orange" | "emerald" | "gray"
type Metric = {
  label: string
  /** 0–1, drives how many indicator bars light up. */
  value: number
  percentage: string
  fraction: string
}

const getCategory = (value: number): Category => {
  if (value < 0.3) return "red"
  if (value < 0.7) return "orange"
  return "emerald"
}

const categoryConfig = {
  red: {
    activeClass: "bg-red-500 dark:bg-red-500",
    bars: 1,
  },
  orange: {
    activeClass: "bg-orange-500 dark:bg-orange-500",
    bars: 2,
  },
  emerald: {
    activeClass: "bg-emerald-500 dark:bg-emerald-500",
    bars: 3,
  },
  gray: {
    activeClass: "bg-gray-300 dark:bg-gray-800",
    bars: 0,
  },
} as const

function Indicator({ number }: { number: number }) {
  const category = getCategory(number)
  const config = categoryConfig[category]
  const inactiveClass = "bg-gray-300 dark:bg-gray-800"

  return (
    <div className="flex gap-0.5">
      {[0, 1, 2].map((index) => (
        <div
          key={index}
          className={`h-3.5 w-1 rounded-sm ${
            index < config.bars ? config.activeClass : inactiveClass
          }`}
        />
      ))}
    </div>
  )
}

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n)

function buildMetrics(): Metric[] {
  const metrics = headlineMetrics()
  const total = store.payments.length
  const captured = filterPayments({ status: "captured" }).length
  const disputed = filterPayments({ status: "disputed" }).length
  const disputeHealth = 1 - (total ? disputed / total : 0)

  return [
    {
      label: "Authorization rate",
      value: metrics.authRate,
      percentage: `${(metrics.authRate * 100).toFixed(1)}%`,
      fraction: `${compact(total - (total - Math.round(metrics.authRate * total)))}/${compact(total)}`,
    },
    {
      label: "Capture rate",
      value: total ? captured / total : 0,
      percentage: `${((total ? captured / total : 0) * 100).toFixed(1)}%`,
      fraction: `${compact(captured)}/${compact(total)}`,
    },
    {
      label: "Dispute-free rate",
      value: disputeHealth,
      percentage: `${(disputeHealth * 100).toFixed(1)}%`,
      fraction: `${compact(total - disputed)}/${compact(total)}`,
    },
  ]
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <div>
      <dt className="text-sm text-gray-500 dark:text-gray-500">
        {metric.label}
      </dt>
      <dd className="mt-1.5 flex items-center gap-2">
        <Indicator number={metric.value} />
        <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {metric.percentage}{" "}
          <span className="font-medium text-gray-400 dark:text-gray-600">
            - {metric.fraction}
          </span>
        </p>
      </dd>
    </div>
  )
}

export function MetricsCards() {
  const metrics = buildMetrics()
  return (
    <>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
        Overview
      </h1>
      <dl className="mt-6 flex flex-wrap items-center gap-x-12 gap-y-8">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </dl>
    </>
  )
}
