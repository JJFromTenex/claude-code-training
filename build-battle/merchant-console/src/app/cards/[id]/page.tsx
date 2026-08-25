import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { formatDate } from "@/lib/dates"
import { maskedNumber } from "@/lib/luhn"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const CATEGORY_LABELS: Record<string, string> = {
  software: "Software",
  advertising: "Advertising",
  travel: "Travel",
  office_supplies: "Office supplies",
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
  const ratio = card.spendLimit > 0 ? card.spend / card.spendLimit : 0
  const pct = Math.min(100, Math.round(ratio * 100))
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
        <CardStatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">{merchant.name}</Field>
        <Field label="Number">
          <span className="font-mono">{maskedNumber(card.last4)}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category">{CATEGORY_LABELS[card.category] ?? card.category}</Field>
        <Field label="Created">
          <span className="font-mono text-sm">{formatDate(card.createdAt)}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-4 max-w-md">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spend, card.currency)}
          </span>
          <span className="text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)} limit
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="img"
          aria-label={`${pct}% of spend limit used`}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              amber ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-3">
        {card.history.map((entry, index) => (
          <li key={index} className="flex items-center gap-3 text-sm">
            <span
              className="size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <span className="text-gray-900 dark:text-gray-50">
              Moved to {entry.status}
            </span>
            <span className="text-gray-500">{formatDate(entry.at)}</span>
          </li>
        ))}
      </ol>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Manage
      </h2>
      <div className="mt-4">
        <CardActions id={card.id} status={card.status} />
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
