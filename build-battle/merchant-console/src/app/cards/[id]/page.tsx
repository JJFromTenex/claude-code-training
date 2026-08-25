import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import {
  CATEGORY_LOCK_LABELS,
  CategoryLock,
  SPEND_WARN_PERCENT,
  maskCardNumber,
  spendPercent,
} from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-actions"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const percent = spendPercent(card.spent, card.spendLimit)
  const warning = percent >= SPEND_WARN_PERCENT
  const remaining = Math.max(0, card.spendLimit - card.spent)

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {card.nickname}
            </h1>
            <StatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">
            {maskCardNumber(card.last4)} · {card.id}
          </p>
        </div>
        <CardStatusActions
          cardId={card.id}
          status={card.status}
          nickname={card.nickname}
        />
      </div>

      <Divider />

      <section aria-label="Spend against limit" className="max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Spend
          </h2>
          <p className="text-sm tabular-nums text-gray-500">
            {formatMoney(card.spent, card.currency)} of{" "}
            {formatMoney(card.spendLimit, card.currency)}
          </p>
        </div>

        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of the spend limit used`}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              warning
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        <p
          className={cx(
            "mt-2 text-sm",
            warning
              ? "text-amber-700 dark:text-amber-400"
              : "text-gray-500",
          )}
        >
          {percent}% used ·{" "}
          {formatMoney(remaining, card.currency)} remaining
          {warning && " · close to the limit"}
        </p>
      </section>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-sm text-gray-500">Merchant</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">
            {merchant.name}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Card number</dt>
          <dd className="mt-1 font-mono text-sm font-medium text-gray-900 dark:text-gray-50">
            {maskCardNumber(card.last4)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Spend limit</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spendLimit, card.currency)} {card.currency}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Category lock</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">
            {card.categoryLock
              ? CATEGORY_LOCK_LABELS[card.categoryLock as CategoryLock]
              : "None"}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Created</dt>
          <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">
            {formatInZone(card.createdAt, merchant.timezone)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Status</dt>
          <dd className="mt-1">
            <StatusBadge status={card.status} />
          </dd>
        </div>
      </dl>

      {card.status === "cancelled" && (
        <p className="mt-6 max-w-xl rounded-md border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800">
          This card was cancelled. Cancelled is terminal — it cannot be
          reactivated or frozen. Issue a new card instead.
        </p>
      )}
    </div>
  )
}
