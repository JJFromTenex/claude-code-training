import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/StatusBadge"
import { cardByIdRecord } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardCategory } from "@/data/types"
import { maskCard } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  ads: "Ads",
  subscriptions: "Subscriptions",
  contractor_tools: "Contractor tools",
  travel: "Travel",
  office: "Office",
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardByIdRecord(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const ratio = card.spendLimit > 0 ? card.spent / card.spendLimit : 0
  const percent = Math.min(100, Math.round(ratio * 100))
  const isNearLimit = ratio >= 0.8

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
        <CardStatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCard(card.last4)}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Category">{CATEGORY_LABELS[card.category]}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label="Created">{formatDate(card.createdAt)}</Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <p className="mt-2 text-sm tabular-nums text-gray-900 dark:text-gray-50">
        {formatMoney(card.spent, card.currency)} of{" "}
        {formatMoney(card.spendLimit, card.currency)}
      </p>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            isNearLimit ? "bg-amber-500" : "bg-blue-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-gray-500">
        Spend is derived from card-linked payments. Nothing in the store
        links payments to cards yet, so this stays at zero.
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Status history
      </h2>
      <ol className="mt-4 space-y-4">
        {card.statusHistory.map((change, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {change.from === null ? "Issued" : `${change.from} → ${change.to}`}
              </p>
              <p className="text-sm text-gray-500">{formatDate(change.at)}</p>
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
