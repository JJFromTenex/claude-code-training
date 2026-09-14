import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { dailyVolume, headlineMetrics } from "@/data/metrics"
import { store } from "@/data/store"
import { Currency } from "@/data/types"
import { formatDate } from "@/lib/dates"
import { formatMoney, formatMoneyCompact } from "@/lib/money"
import Link from "next/link"
import { VolumeChart } from "./volume-chart"

export default function OverviewPage() {
  const metrics = headlineMetrics()
  const chartCurrency: Currency = "USD"
  const volume = dailyVolume(30, chartCurrency)

  const recent = [...store.payments]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8)

  return (
    <div className="border-t border-gray-200 p-4 sm:p-6 dark:border-gray-800">
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Stat
          label="Net volume"
          value={metrics.volume
            .map((v) => formatMoneyCompact(v.net, v.currency))
            .join(" · ")}
          sub={`Last 120 days · refunds of ${metrics.volume
            .map((v) => formatMoneyCompact(v.refunded, v.currency))
            .join(" · ")} deducted`}
        />
        <Stat
          label="Payments"
          value={metrics.paymentCount.toLocaleString()}
          sub={`${store.disputes.length} disputes opened`}
        />
        <Stat
          label="Open disputes"
          value={String(metrics.openDisputes)}
          sub={`${metrics.disputedByCurrency
            .filter((d) => d.amount > 0)
            .map((d) => formatMoney(d.amount, d.currency))
            .join(" · ") || "nothing"} at risk`}
        />
      </dl>

      <div className="mt-10">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Daily volume
        </h2>
        <p className="mt-0.5 text-sm/6 text-gray-500">
          Captured against refunded over the last 30 days, {chartCurrency} merchants, UTC days.
        </p>
        <VolumeChart data={volume} currency={chartCurrency} />
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
  value: string
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
