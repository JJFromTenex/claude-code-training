import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById, eventsForCard } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardRowActions } from "../row-actions"
import { SpendBar } from "../spend-bar"

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const events = eventsForCard(card.id)

  return (
    <section aria-label={`Card ${card.nickname}`} className="px-4 py-6 sm:px-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        &larr; All cards
      </Link>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <StatusBadge status={card.status} />
        </div>
        <CardRowActions
          id={card.id}
          nickname={card.nickname}
          status={card.status}
        />
      </div>
      <p className="mt-1 text-sm tabular-nums text-gray-500">{card.id}</p>

      <Divider />

      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
        <Field label="Merchant">{merchant?.name}</Field>
        <Field label="Card number">{maskCardNumber(card.last4)}</Field>
        <Field label="Number reference">{card.numberRef}</Field>
        <Field label="Category lock">
          <span className="capitalize">{card.categoryLock ?? "None"}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Created (UTC)">{card.createdAt}</Field>
        <Field label={`Created (${merchant?.timezone})`}>
          {merchant ? formatInZone(card.createdAt, merchant.timezone) : null}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-3 max-w-md">
        <SpendBar
          spent={card.spent}
          limit={card.spendLimit}
          currency={card.currency}
        />
      </div>
      <p className="mt-3 max-w-prose text-sm text-gray-500">
        Nothing is captured against a card in this console, so spend is zero at
        issue and stays there. The bar reads the record rather than an estimate.
      </p>

      <Divider />

      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-3 space-y-3">
        {events.map((event, index) => (
          <li key={index} className="flex gap-3 text-sm">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-gray-600"
              aria-hidden="true"
            />
            <div>
              <p className="capitalize text-gray-900 dark:text-gray-50">
                {event.from ? `${event.from} → ${event.to}` : "Issued"}
              </p>
              <p className="text-gray-500">
                {merchant
                  ? formatInZone(event.at, merchant.timezone)
                  : event.at}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
      <dd className="mt-0.5 text-sm tabular-nums text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
