import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusControl } from "./status-control"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  shipping: "Shipping",
  office_supplies: "Office supplies",
  travel: "Travel",
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = store.cards.find((c) => c.id === id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const percentSpent = card.spendLimit
    ? Math.min(100, Math.round((card.spent / card.spendLimit) * 100))
    : 0
  const isAmber = percentSpent >= 80

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
            <CardStatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">
            {maskCardNumber(card.last4)}
          </p>
        </div>
        <CardStatusControl cardId={card.id} status={card.status} />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant?.name ?? card.merchantId}
          {merchant && (
            <span className="ml-2 text-gray-500">{merchant.country}</span>
          )}
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category lock">
          {card.categoryLock ? CATEGORY_LABELS[card.categoryLock] : "None"}
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        {merchant && (
          <Field label={`Created (${merchant.timezone})`}>
            {formatInZone(card.createdAt, merchant.timezone)}
          </Field>
        )}
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-3 max-w-md">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}
          </span>
          <span className="text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            role="progressbar"
            aria-valuenow={percentSpent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Spend against limit"
            className={cx(
              "h-full rounded-full transition-all",
              isAmber ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${percentSpent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {percentSpent}% of limit used
        </p>
      </div>
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
