import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, isNearLimit, maskNumber, spendRatio } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../status-actions"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const ratio = spendRatio(card.spent, card.limit)
  const near = isNearLimit(ratio)

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
        {maskNumber(card.last4)} · {card.id}
      </p>

      <div className="mt-4">
        <CardStatusActions cardId={card.id} status={card.status} showCancel />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.limit, card.currency)}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Merchant category lock">
          {card.category ? CARD_CATEGORY_LABELS[card.category] : "None"}
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">Against limit</span>
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)} of{" "}
            {formatMoney(card.limit, card.currency)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={cx(
              "h-full rounded-full transition-[width]",
              near ? "bg-amber-500 dark:bg-amber-500" : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {near && (
          <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-500">
            Over 80% of the limit spent.
          </p>
        )}
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((entry, index) => (
          <li key={index} className="flex items-center gap-3">
            <span
              className="size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <StatusBadge status={entry.status} />
            <span className="text-sm text-gray-500">
              {formatInZone(entry.at, merchant.timezone)}
            </span>
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
