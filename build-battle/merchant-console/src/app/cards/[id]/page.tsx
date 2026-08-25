import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatDate, formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SpendBar } from "../spend-bar"
import { StatusActions } from "../status-actions"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  contractors: "Contractors",
  travel: "Travel",
  other: "Other",
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const remaining = Math.max(0, card.spendLimit - card.spend)

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
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <div className="max-w-xl">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Spend against limit
        </h2>
        <div className="mt-3">
          <SpendBar
            spend={card.spend}
            limit={card.spendLimit}
            currency={card.currency}
          />
        </div>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-sm text-gray-500">Merchant</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
            {merchant?.name ?? card.merchantId}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Card number</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium text-gray-900 dark:text-gray-50">
            {maskCardNumber(card.last4)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Reference</dt>
          <dd className="mt-0.5 font-mono text-sm font-medium text-gray-900 dark:text-gray-50">
            {card.reference}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Spend limit</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spendLimit, card.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Spent</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spend, card.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Remaining</dt>
          <dd className="mt-0.5 text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(remaining, card.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Currency</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
            {card.currency}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Category lock</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
            {CATEGORY_LABELS[card.category] ?? card.category}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Created</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
            {formatDate(card.createdAt)}
            {merchant && (
              <span className="ml-1 font-normal text-gray-500">
                ({formatInZone(card.createdAt, merchant.timezone)} merchant time)
              </span>
            )}
          </dd>
        </div>
      </dl>

      <Divider />

      <StatusActions card={card} showCancel />
    </div>
  )
}
