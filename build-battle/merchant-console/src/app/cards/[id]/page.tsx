import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { SpendBar } from "@/components/ui/cards/SpendBar"
import { cardById, cardSpend } from "@/data/cardQueries"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
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
  const spent = cardSpend(card)

  const facts = [
    { label: "Merchant", value: merchant.name },
    { label: "Number", value: maskCardNumber(card.last4) },
    { label: "Spend limit", value: formatMoney(card.spendLimit, card.currency) },
    { label: "Currency", value: card.currency },
    {
      label: "Category lock",
      value:
        card.categoryLock === null
          ? "None"
          : (CATEGORY_LABELS[card.categoryLock] ?? card.categoryLock),
    },
    { label: "Issued", value: formatInZone(card.createdAt, merchant.timezone) },
  ]

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← Cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <CardStatusBadge status={card.status} />
      </div>
      <p className="mt-1 text-sm text-gray-500">{card.id}</p>

      <Divider />

      <div className="max-w-md">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Spend against limit
        </h2>
        <div className="mt-3">
          <SpendBar
            spent={spent}
            limit={card.spendLimit}
            currency={card.currency}
          />
        </div>
        {spent === 0 && (
          <p className="mt-2 text-sm text-gray-500">
            Nothing has been spent on this card yet.
          </p>
        )}
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt className="text-sm text-gray-500">{fact.label}</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <Divider />

      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-3 space-y-2">
        {card.history.map((event, index) => (
          <li key={index} className="flex items-baseline gap-3 text-sm">
            <span className="text-gray-500">
              {formatInZone(event.at, merchant.timezone)}
            </span>
            <span className="text-gray-900 dark:text-gray-50">
              {event.from === null
                ? "Issued as active"
                : `${event.from} → ${event.to}`}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
