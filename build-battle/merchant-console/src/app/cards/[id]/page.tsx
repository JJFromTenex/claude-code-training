import { CardActions } from "@/app/cards/card-actions"
import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEvent } from "@/data/types"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SpendProgress } from "./spend-progress"

/** How a status change reads on the timeline. Local: no other page shows card history. */
function eventLabel(event: CardEvent): string {
  if (event.from === null) return "Issued"
  if (event.to === "cancelled") return "Cancelled"
  if (event.to === "frozen") return "Frozen"
  if (event.from === "frozen" && event.to === "active") return "Unfrozen"
  return "Active"
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
  const timezone = merchant?.timezone ?? "UTC"
  const timeline = [...card.history].sort((a, b) => a.at.localeCompare(b.at))

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
        <div className="ml-auto">
          <CardActions card={card} />
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant?.name ?? "Unknown merchant"}
          {merchant && <span className="ml-2 text-gray-500">{merchant.country}</span>}
        </Field>
        <Field label="Card number">
          <span className="font-mono text-sm">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Number reference">
          <span className="font-mono text-xs">{card.numberRef}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Spent">{formatMoney(card.spent, card.currency)}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category lock">
          {card.categoryLock ? CARD_CATEGORY_LABELS[card.categoryLock] : "No lock"}
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${timezone})`}>
          {formatInZone(card.createdAt, timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <SpendProgress
        spent={card.spent}
        limit={card.spendLimit}
        currency={card.currency}
      />
      <p className="mt-2 text-sm text-gray-500">
        Nothing in the console records card spend yet, so this stays at zero
        until spend is linked to cards.
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Timeline
      </h2>
      <ol className="mt-4 space-y-4">
        {timeline.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {eventLabel(event)}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, timezone)}
              </p>
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
