import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById, spendForCard } from "@/data/queries"
import { formatDate } from "@/lib/dates"
import { maskedNumber } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../status-actions"

const CATEGORY_LABEL: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office: "Office",
  contractors: "Contractors",
  any: "Any category",
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const spend = spendForCard(card)
  const pct = card.limit > 0 ? Math.min(100, (spend / card.limit) * 100) : 0
  const amber = pct >= 80
  const barColor = amber
    ? "bg-amber-500 dark:bg-amber-400"
    : "bg-emerald-500 dark:bg-emerald-400"

  return (
    <section
      aria-label={`Card ${card.nickname}`}
      className="mx-auto max-w-3xl px-4 py-6 sm:px-6"
    >
      <p className="text-sm text-gray-500">
        <Link
          href="/cards"
          className="text-blue-600 hover:underline dark:text-blue-500"
        >
          ← Cards
        </Link>
      </p>

      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="text-sm text-gray-500">
            {merchant?.name ?? card.merchantId} · Issued{" "}
            {formatDate(card.createdAt)}
          </p>
        </div>
        <CardStatusBadge status={card.status} />
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Number</dt>
            <dd className="mt-0.5 font-mono text-gray-900 dark:text-gray-50">
              {maskedNumber(card.last4)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Reference</dt>
            <dd className="mt-0.5 font-mono text-sm text-gray-700 dark:text-gray-300">
              {card.reference}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Spend limit</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-gray-900 dark:text-gray-50">
              {formatMoney(card.limit, card.currency)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Category lock</dt>
            <dd className="mt-0.5 text-gray-900 dark:text-gray-50">
              {CATEGORY_LABEL[card.category] ?? card.category}
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Spend against limit
          </h2>
          <p className="text-sm tabular-nums text-gray-500">
            {formatMoney(spend, card.currency)} of{" "}
            {formatMoney(card.limit, card.currency)}
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="Spend as a percentage of the limit"
        >
          <div
            className={cx("h-full rounded-full", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p
          className={cx(
            "mt-1 text-xs",
            amber
              ? "text-amber-700 dark:text-amber-400"
              : "text-gray-500",
          )}
        >
          {pct.toFixed(1)}% used
          {amber && " — over 80%, consider raising the limit or freezing"}
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Actions
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Freeze and unfreeze without a reload. Cancelling is permanent.
        </p>
        <div className="mt-3">
          <CardStatusActions cardId={card.id} status={card.status} />
        </div>
      </div>
    </section>
  )
}
