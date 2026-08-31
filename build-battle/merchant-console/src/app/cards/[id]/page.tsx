import { Divider } from "@/components/Divider"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS } from "@/data/types"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"
import { SpendBar } from "../spend-bar"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)

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
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        •••• {card.last4} · {card.id}
      </p>

      <div className="mt-4">
        <CardStatusActions cardId={card.id} initialStatus={card.status} />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant ? (
            merchant.name
          ) : (
            <span className="text-gray-500">Unknown merchant</span>
          )}
        </Field>
        <Field label="Limit">{formatMoney(card.limit, card.currency)}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category">
          {card.category ? CARD_CATEGORY_LABELS[card.category] : "—"}
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label="Created">{formatDate(card.createdAt)}</Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-4 max-w-sm">
        <SpendBar spend={card.spend} limit={card.limit} currency={card.currency} />
      </div>
      <p className="mt-2 text-sm text-gray-500">
        No purchases have posted to this card yet — spend tracking has nothing
        to show until a transaction feed exists.
      </p>
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
