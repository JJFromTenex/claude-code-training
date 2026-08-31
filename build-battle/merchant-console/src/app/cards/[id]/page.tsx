import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CATEGORY_LABELS } from "../labels"
import { CardStatusActions } from "./status-actions"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const timezone = merchant?.timezone ?? "UTC"
  const spendRatio = card.limit > 0 ? card.spent / card.limit : 0
  const spendPercent = Math.min(100, Math.round(spendRatio * 100))
  const isNearLimit = spendRatio >= 0.8

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {card.id} · •••• {card.last4}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant ? (
            <>
              {merchant.name}
              <span className="ml-2 text-gray-500">{merchant.country}</span>
            </>
          ) : (
            card.merchantId
          )}
        </Field>
        <Field label="Category">{CATEGORY_LABELS[card.category]}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Spend limit">{formatMoney(card.limit, card.currency)}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${timezone})`}>
          {formatInZone(card.createdAt, timezone)}
        </Field>
      </dl>

      <Divider />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          Spend
        </h2>
        <CardStatusActions cardId={card.id} status={card.status} />
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}{" "}
            <span className="text-gray-500">
              of {formatMoney(card.limit, card.currency)}
            </span>
          </span>
          <span
            className={cx(
              "text-sm font-medium",
              isNearLimit
                ? "text-amber-600 dark:text-amber-500"
                : "text-gray-500",
            )}
          >
            {spendPercent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={spendPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Spent ${spendPercent}% of the limit`}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              isNearLimit ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${spendPercent}%` }}
          />
        </div>
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {event.status === "active" && index === 0
                  ? "Issued"
                  : `Moved to ${event.status}`}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
