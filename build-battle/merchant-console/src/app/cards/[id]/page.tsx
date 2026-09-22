import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { StatusActions } from "./status-actions"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = store.cards.find((c) => c.id === id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const spendPercent = 0
  const limitDisplay = formatMoney(card.spendLimit, card.currency)

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
      <p className="mt-1 font-mono text-sm text-gray-500">•••• {card.last4}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">{merchant?.name ?? card.merchantId}</Field>
        <Field label="Spend limit">{limitDisplay}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Created">{formatDate(card.createdAt)}</Field>
        {card.category && (
          <Field label="Category">{card.category.replace("_", " ")}</Field>
        )}
        <Field label="Card ID">
          <span className="font-mono text-sm">{card.id}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-3 space-y-2">
        <div className="flex justify-between text-sm text-gray-500">
          <span>{formatMoney(0, card.currency)} spent</span>
          <span>{limitDisplay} limit</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
          <div
            className={`h-full rounded-full transition-all ${
              spendPercent >= 80
                ? "bg-amber-500"
                : "bg-emerald-500"
            }`}
            style={{ width: `${spendPercent}%` }}
            role="progressbar"
            aria-valuenow={spendPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${spendPercent}% of spend limit used`}
          />
        </div>
        <p className="text-xs text-gray-400">
          {spendPercent}% of limit used
        </p>
      </div>

      <Divider />

      <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
        Actions
      </h2>
      <StatusActions cardId={card.id} status={card.status} />
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
