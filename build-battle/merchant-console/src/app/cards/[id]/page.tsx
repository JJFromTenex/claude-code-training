import { ProgressBar } from "@/components/ProgressBar"
import { Divider } from "@/components/Divider"
import { cardById } from "@/data/cardQueries"
import { merchantById } from "@/data/merchants"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusControl } from "../card-status-control"

const CATEGORY_LABELS: Record<string, string> = {
  retail: "Retail",
  travel: "Travel",
  dining: "Dining",
  software: "Software",
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
        <CardStatusControl id={card.id} status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {card.id} · •••• {card.last4}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant?.name ?? card.merchantId}
          {merchant && <span className="ml-2 text-gray-500">{merchant.country}</span>}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category">
          {card.category ? CATEGORY_LABELS[card.category] : "—"}
        </Field>
        <Field label="Spend limit">{formatMoney(card.spendLimit, card.currency)}</Field>
        <Field label="Created">
          <span className="font-mono text-sm">{formatDate(card.createdAt)}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm text-gray-500">{card.numberRef}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Spend</h2>
      <div className="mt-4 max-w-sm">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}
          </span>
          <span className="text-gray-500">of {formatMoney(card.spendLimit, card.currency)}</span>
        </div>
        <ProgressBar value={card.spent} max={card.spendLimit} className="mt-2" />
        {card.spent === 0 && (
          <p className="mt-2 text-sm text-gray-500">No spend recorded yet.</p>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
