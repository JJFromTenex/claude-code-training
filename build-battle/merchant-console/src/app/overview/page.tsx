import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { dailyVolume, headlineMetrics } from "@/data/metrics"
import { queryPayments } from "@/data/queries"
import { store } from "@/data/store"
import { CURRENCIES, Currency } from "@/data/types"
import { formatDate } from "@/lib/dates"
import { formatMoney, formatMoneyCompact } from "@/lib/money"
import Link from "next/link"
import { VolumeChart } from "./volume-chart"

/** Currencies with a nonzero amount, each rendered with its own symbol. */
function nonZeroAmounts(
  amounts: Record<Currency, number>,
  format: (minorUnits: number, currency: Currency) => string,
): string[] {
  return CURRENCIES.filter((currency) => amounts[currency] !== 0).map(
    (currency) => format(amounts[currency], currency),
  )
}

export default function OverviewPage() {
  const metrics = headlineMetrics()
  const volume = dailyVolume(30)

  const chartData = volume.map((day) => ({
    date: day.date.slice(5),
    captured: day.captured,
    refunded: day.refunded,
  }))

  const { rows: recent } = queryPayments({
    sort: "createdAt",
    direction: "desc",
    pageSize: 8,
  })

  const grossVolumeLines = nonZeroAmounts(metrics.grossVolume, formatMoneyCompact)
  const disputedAmountLines = nonZeroAmounts(metrics.disputedAmount, formatMoney)

  return (
    <div className="border-t border-gray-200 p-4 sm:p-6 dark:border-gray-800">
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Stat
          label="Gross volume"
          value={
            grossVolumeLines.length > 0 ? (
              <AmountStack amounts={grossVolumeLines} />
            ) : (
              formatMoneyCompact(0, "USD")
            )
          }
          sub="Last 120 days"
        />
        <Stat
          label="Payments"
          value={metrics.paymentCount.toLocaleString()}
          sub={`${store.disputes.length} disputes opened`}
        />
        <Stat
          label="Open disputes"
          value={String(metrics.openDisputes)}
          sub={
            disputedAmountLines.length > 0
              ? `${disputedAmountLines.join(" · ")} at risk`
              : "Nothing at risk"
          }
        />
      </dl>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Daily volume
        </h2>
        <p className="mt-0.5 text-sm/6 text-gray-500">
          Captured against refunded over the last 30 days.
        </p>
        <VolumeChart data={chartData} />
      </div>

      <div className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Recent payments
          </h2>
          <Link
            href="/payments"
            className="text-sm text-blue-600 hover:underline dark:text-blue-500"
          >
            View all
          </Link>
        </div>
        <ul className="mt-2 divide-y divide-gray-200 dark:divide-gray-800">
          {recent.map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/payments/${payment.id}`}
                  className="text-sm font-medium text-gray-900 hover:underline dark:text-gray-50"
                >
                  {merchantById(payment.merchantId)?.name}
                </Link>
                <p className="truncate text-sm text-gray-500">
                  {payment.description} · {formatDate(payment.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(payment.amount, payment.currency)}
                </span>
                <StatusBadge status={payment.status} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string
  value: React.ReactNode
  sub?: string
}) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
        {value}
      </dd>
      {sub && <p className="mt-1 text-sm text-gray-500">{sub}</p>}
    </div>
  )
}

/** Stacks one amount per currency, for a stat that may hold more than one. */
function AmountStack({ amounts }: { amounts: string[] }) {
  return (
    <div className="space-y-0.5">
      {amounts.map((amount) => (
        <div key={amount}>{amount}</div>
      ))}
    </div>
  )
}
