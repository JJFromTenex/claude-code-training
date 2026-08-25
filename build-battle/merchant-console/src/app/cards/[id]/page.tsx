import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { MerchantCategory } from "@/data/types"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  utilities: "Utilities",
  office_supplies: "Office supplies",
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

  // Spend against the limit, computed in minor units. Both are integers; the
  // ratio is only used to size the bar and pick its colour.
  const ratio = card.spendLimit > 0 ? card.spend / card.spendLimit : 0
  const pct = Math.min(100, Math.round(ratio * 100))
  const overThreshold = pct >= 80

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
      <p className="mt-1 font-mono text-sm text-gray-500">
        •••• {card.last4} · {card.id}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category lock">
          {card.category ? CATEGORY_LABELS[card.category] : "—"}
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
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
        Spend against limit
      </h2>
      <div className="mt-3 max-w-md">
        <div className="flex items-baseline justify-between text-sm">
          <span className="tabular-nums font-medium text-gray-900 dark:text-gray-50">
            {formatMoney(card.spend, card.currency)}
          </span>
          <span className="tabular-nums text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)} · {pct}%
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Spend against limit"
        >
          <div
            className={cx(
              "h-full rounded-full",
              overThreshold
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            // Width is the one genuinely data-driven value; Tailwind cannot
            // express an arbitrary runtime percentage as a class.
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
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
