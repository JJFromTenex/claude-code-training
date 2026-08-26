import { Divider } from "@/components/Divider"
import { CardStatusToggle } from "@/components/ui/cards/CardStatusToggle"
import { SpendProgress } from "@/components/ui/cards/SpendProgress"
import { DetailField } from "@/components/ui/DetailField"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cardQueries"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cardNumber"
import { formatDate } from "@/lib/dates"
import Link from "next/link"
import { notFound } from "next/navigation"

const CATEGORY_LABELS: Record<string, string> = {
  subscriptions: "Vendor subscriptions",
  advertising: "Ad spend",
  contractor_tools: "Contractor tools",
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
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailField label="Merchant">{merchant?.name ?? "—"}</DetailField>
        <DetailField label="Currency">{card.currency}</DetailField>
        <DetailField label="Category">
          {card.category ? CATEGORY_LABELS[card.category] : "—"}
        </DetailField>
        <DetailField label="Created">{formatDate(card.createdAt)}</DetailField>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-4 max-w-sm">
        <SpendProgress spent={0} limit={card.limit} currency={card.currency} />
      </div>

      <Divider />

      <CardStatusToggle id={card.id} status={card.status} />
    </div>
  )
}
