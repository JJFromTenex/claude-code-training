import { Divider } from "@/components/Divider"
import { SpendProgress } from "@/components/ui/cards/SpendProgress"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { CATEGORY_LABELS, cardById, spendPercent } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const STATUS_VERB: Record<string, string> = {
  active: "Unfrozen",
  frozen: "Frozen",
  cancelled: "Cancelled",
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
  const percent = spendPercent(card)
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

      {card.status === "frozen" && (
        <p className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
          This card is frozen. Authorisations are declined until it is
          unfrozen.
        </p>
      )}
      {card.status === "cancelled" && (
        <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
          This card is cancelled. Cancellation is permanent — issue a new card
          rather than trying to bring this one back.
        </p>
      )}

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-xl">
        <SpendProgress
          spend={card.spend}
          spendLimit={card.spendLimit}
          currency={card.currency}
          percent={percent}
        />
        <p className="mt-2 text-sm text-gray-500">
          {formatMoney(remaining, card.currency)} left to spend.
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Category lock">
          {card.category ? CATEGORY_LABELS[card.category] : "No lock"}
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.events.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {event.from === null
                  ? `Card issued · limit ${formatMoney(card.spendLimit, card.currency)}`
                  : `${STATUS_VERB[event.to]} — ${event.from} → ${event.to}`}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Actions
      </h2>
      <div className="mt-4">
        <CardActions cardId={card.id} status={card.status} allowCancel />
      </div>
      <p className="mt-3 text-sm text-gray-500">
        A card moves between active and frozen as often as ops needs. Cancelling
        is one way only.
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
