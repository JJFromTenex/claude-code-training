import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/card-mask"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { CardStatusActions } from "../card-status-actions"

const CATEGORY_LABELS: Record<string, string> = {
  any: "No lock",
  advertising: "Advertising",
  software: "Software & subscriptions",
  contractors: "Contractors",
  travel: "Travel",
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
  // Percentages are display maths on two minor-unit integers; the amounts
  // themselves stay integers.
  const percent =
    card.spendLimit > 0
      ? Math.min(100, Math.round((card.spend / card.spendLimit) * 100))
      : 0
  const nearLimit = percent >= 80
  const remaining = Math.max(0, card.spendLimit - card.spend)

  return (
    <section aria-label={`Card ${card.nickname}`} className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {card.nickname}
            </h1>
            <StatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono text-sm tabular-nums text-gray-500">
            {maskCardNumber(card.last4)}
          </p>
        </div>
        <CardStatusActions cardId={card.id} status={card.status} />
      </div>

      <div className="mt-8 max-w-xl rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Spend against limit
          </h2>
          <p className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spend, card.currency)}{" "}
            <span className="font-normal text-gray-500">
              of {formatMoney(card.spendLimit, card.currency)}
            </span>
          </p>
        </div>
        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Spend against limit"
        >
          <div
            className={`h-full rounded-full transition-all ${
              nearLimit
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-blue-500 dark:bg-blue-500"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {percent}% used ·{" "}
          {formatMoney(remaining, card.currency)} remaining
          {nearLimit && (
            <span className="ml-1 font-medium text-amber-600 dark:text-amber-500">
              — approaching the limit
            </span>
          )}
        </p>
      </div>

      <dl className="mt-8 grid max-w-xl grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <Field label="Card ID">
          <span className="font-mono">{card.id}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono">{card.reference}</span>
        </Field>
        <Field label="Merchant">{merchant?.name ?? card.merchantId}</Field>
        <Field label="Category lock">
          {CATEGORY_LABELS[card.category] ?? card.category}
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Status">{card.status}</Field>
        <Field label="Created">{formatDate(card.createdAt)}</Field>
      </dl>

      <p className="mt-8 max-w-xl text-xs text-gray-500">
        The full card number was shown once, when the card was issued. Only the
        last four is stored.
      </p>
    </section>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
