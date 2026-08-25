import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

const EVENT_LABELS: Record<string, string> = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
}

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  professional_services: "Professional services",
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
  const ratio = card.spendLimit > 0 ? card.spent / card.spendLimit : 0
  const percent = Math.min(100, Math.round(ratio * 100))
  const amber = ratio >= 0.8

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
        <span className="font-mono text-sm text-gray-500">
          {maskCard(card.last4)}
        </span>
        <CardStatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-3 max-w-xl">
        <div className="flex items-baseline justify-between text-sm">
          <span className="tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)} spent
          </span>
          <span className="tabular-nums text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)} · {percent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Spend against limit"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full",
              amber
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        {amber && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
            This card has used {percent}% of its limit.
          </p>
        )}
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mb-6 mt-4 space-y-4">
        {card.history.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[entry.event]}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(entry.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Number">
          <span className="font-mono">{maskCard(card.last4)}</span>
        </Field>
        <Field label="Number reference">
          <span className="font-mono text-sm">{card.numberRef}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Category lock">
          {card.categoryLock ? CATEGORY_LABELS[card.categoryLock] : "None"}
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>
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
