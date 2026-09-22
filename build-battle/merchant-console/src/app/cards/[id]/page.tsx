import { Divider } from "@/components/Divider"
import { SpendProgressBar } from "@/components/ui/cards/SpendProgressBar"
import { cardById } from "@/data/cardQueries"
import { merchantById } from "@/data/merchants"
import { CardCategory } from "@/data/types"
import { formatDate } from "@/lib/dates"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "./card-actions"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  software: "Software",
  advertising: "Advertising",
  travel: "Travel",
  office_supplies: "Office supplies",
  professional_services: "Professional services",
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

  const merchant = merchantById(card.merchantId)!

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-gray-900 dark:text-gray-50">
        {card.nickname}
      </h1>
      <p className="mt-1 font-mono text-sm text-gray-500">•••• {card.last4}</p>

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

      <SpendProgressBar spent={card.spent} limit={card.limit} currency={card.currency} />

      <Divider />

      <CardActions card={card} />
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
