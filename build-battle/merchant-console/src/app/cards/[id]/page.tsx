import { Divider } from "@/components/Divider"
import { SpendBar } from "@/components/ui/cards/SpendBar"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

const EVENT_LABELS: Record<string, string> = {
  active: "Activated",
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
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <div className="mt-4">
        <CardStatusActions id={card.id} status={card.status} />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
        <Field label="Category">
          {CATEGORY_LABELS[card.category] ?? card.category}
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.limit, card.currency)}
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Spent">{formatMoney(card.spent, card.currency)}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-md">
        <SpendBar
          spent={card.spent}
          limit={card.limit}
          currency={card.currency}
        />
        {card.spent === 0 && (
          <p className="mt-3 text-sm text-gray-500">
            Nothing has been spent on this card. The console does not see card
            authorizations, so spend stays at zero until it does.
          </p>
        )}
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {entry.from === null
                  ? "Card issued"
                  : `${EVENT_LABELS[entry.to] ?? entry.to} from ${entry.from}`}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(entry.at, merchant.timezone)} · {entry.actor}
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
