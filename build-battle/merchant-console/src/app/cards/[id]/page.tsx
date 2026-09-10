import { Divider } from "@/components/Divider"
import { SpendProgress } from "@/components/ui/cards/SpendProgress"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEventType } from "@/data/types"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardRowActions } from "../card-row-actions"

const EVENT_LABELS: Record<CardEventType, string> = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
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

  const merchant = merchantById(card.merchantId)
  const timezone = merchant?.timezone ?? "UTC"
  const available = Math.max(0, card.spendLimit - card.spent)
  const timeline = [...card.events].sort((a, b) => a.at.localeCompare(b.at))

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
          <CardRowActions
            id={card.id}
            nickname={card.nickname}
            status={card.status}
          />
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-4 max-w-xl">
        <SpendProgress
          spent={card.spent}
          limit={card.spendLimit}
          currency={card.currency}
        />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant?.name ?? card.merchantId}
          {merchant && (
            <span className="ml-2 text-gray-500">{merchant.country}</span>
          )}
        </Field>
        <Field label="Number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
          <span className="ml-2 text-gray-500">shown in full once, at issue</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono">{card.numberRef}</span>
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Spent">
          <span className="tabular-nums">
            {formatMoney(card.spent, card.currency)}
          </span>
        </Field>
        <Field label="Available">
          <span className="tabular-nums">
            {formatMoney(available, card.currency)}
          </span>
        </Field>
        <Field label="Category lock">
          {card.categoryLock
            ? CARD_CATEGORY_LABELS[card.categoryLock]
            : "None. Any merchant category."}
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
                {EVENT_LABELS[event.type]}
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
