import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { SpendProgress } from "@/components/ui/cards/SpendProgress"
import { CATEGORY_LABELS } from "@/data/card-catalog"
import {
  authorizationsForCard,
  cardById,
  cardSpend,
  eventsForCard,
} from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEventType } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const EVENT_LABELS: Record<CardEventType, string> = {
  issued: "Card issued",
  frozen: "Card frozen",
  unfrozen: "Card unfrozen",
  cancelled: "Card cancelled",
}

/**
 * Card detail: the full record and spend against the limit. The number shown
 * is the masked last four; the full one was returned once, at creation.
 */
export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const authorizations = authorizationsForCard(card.id)
  const masked = maskCardNumber(card.last4)

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {card.nickname}
            </h1>
            <CardStatusBadge status={card.status} />
          </div>
          <p
            className="mt-1 font-mono text-sm text-gray-500"
            aria-label={`Card ending ${card.last4}, ${card.id}`}
          >
            {masked} · {card.id}
          </p>
        </div>
        <CardActions
          cardId={card.id}
          nickname={card.nickname}
          last4={card.last4}
          status={card.status}
        />
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-xl">
        <SpendProgress
          spent={cardSpend(card.id)}
          spendLimit={card.spendLimit}
          currency={card.currency}
        />
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
        <Field label="Category lock">{CATEGORY_LABELS[card.categoryLock]}</Field>
        <Field label="Card number">
          <span className="font-mono">{masked}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
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
        Authorisations
      </h2>
      {authorizations.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Nothing has been authorised on this card yet. Spend appears here as
          the card is used.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {authorizations.map((auth) => (
            <li
              key={auth.id}
              className="flex items-baseline justify-between gap-4 border-b border-gray-200 pb-3 last:border-0 dark:border-gray-800"
            >
              <div>
                <p className="text-sm text-gray-900 dark:text-gray-50">
                  {auth.description}
                </p>
                <p className="text-sm text-gray-500">
                  {formatInZone(auth.createdAt, merchant.timezone)}
                </p>
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
                {formatMoney(auth.amount, auth.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {eventsForCard(card.id).map((event) => (
          <li key={event.id} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[event.type]}
                <span className="ml-2 text-gray-500">{event.detail}</span>
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
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
