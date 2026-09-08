import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { mask } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const CATEGORY_LABELS = {
  retail: "Retail",
  marketplace: "Marketplace",
  subscription: "Subscription",
  services: "Services",
} as const

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const ratio = card.spendLimit > 0 ? card.spend / card.spendLimit : 0
  const percent = Math.round(ratio * 100)
  const barColor =
    ratio > 0.8
      ? "bg-amber-500 dark:bg-amber-400"
      : "bg-blue-500 dark:bg-blue-500"

  return (
    <section aria-label="Card detail" className="px-4 py-6 sm:p-6">
      <p className="mb-2 text-sm">
        <Link
          href="/cards"
          className="text-blue-600 hover:underline dark:text-blue-500"
        >
          ← All cards
        </Link>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {merchant?.name ?? card.merchantId} ·{" "}
            <span className="font-mono">{mask(card.last4)}</span>
          </p>
        </div>
        <CardStatusBadge status={card.status} />
      </div>

      <div className="mt-6 rounded-md border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Spend against limit
          </p>
          <p className="tabular-nums text-sm text-gray-500 dark:text-gray-500">
            {percent}%
          </p>
        </div>
        <p className="mt-1 tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(card.spend, card.currency)} of{" "}
          {formatMoney(card.spendLimit, card.currency)}
        </p>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of spend limit used`}
        >
          <div
            className={cx("h-full rounded-full transition-all", barColor)}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gray-500">Card ID</dt>
          <dd className="font-mono text-sm text-gray-900 dark:text-gray-50">
            {card.id}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Category lock</dt>
          <dd className="text-sm font-medium text-gray-900 dark:text-gray-50">
            {CATEGORY_LABELS[card.category]}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Currency</dt>
          <dd className="text-sm font-medium text-gray-900 dark:text-gray-50">
            {card.currency}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Created</dt>
          <dd className="text-sm text-gray-900 dark:text-gray-50">
            {formatDate(card.createdAt)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
