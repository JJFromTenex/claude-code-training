import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

/** Amber once spend passes this share of the limit. */
const WARN_PERCENT = 80

/**
 * Bar widths in 5% steps, written out so Tailwind can generate them and no
 * inline style is needed. The exact percentage is printed beside the bar.
 */
const BAR_WIDTHS = [
  "w-0",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-full",
]

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
  const remaining = card.spendLimit - card.spent
  // Integer percentage for the bar. Display only; the amounts stay in minor units.
  const percent = Math.min(100, Math.floor((card.spent * 100) / card.spendLimit))
  const warn = percent >= WARN_PERCENT

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
        <span className="font-mono text-sm tabular-nums text-gray-500">
          {maskCard(card.last4)}
        </span>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant?.name ?? card.merchantId}
          {merchant && <span className="ml-2 text-gray-500">{merchant.country}</span>}
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">{formatMoney(card.spendLimit, card.currency)}</span>
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Number">
          <span className="font-mono tabular-nums">{maskCard(card.last4)}</span>
        </Field>
        <Field label="Number reference">
          <span className="font-mono text-sm">{card.numberRef}</span>
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${timezone})`}>{formatInZone(card.createdAt, timezone)}</Field>
        <Field label={`Last changed (${timezone})`}>
          {formatInZone(card.updatedAt, timezone)}
        </Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 max-w-xl">
        <div className="flex items-baseline justify-between text-sm">
          <span className="tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)} spent
          </span>
          <span className="tabular-nums text-gray-500">
            {formatMoney(remaining, card.currency)} remaining · {percent}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Spend against limit"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              warn ? "bg-amber-500" : "bg-blue-500",
              BAR_WIDTHS[Math.round(percent / 5)],
            )}
          />
        </div>
        {warn && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            Over {WARN_PERCENT}% of the limit has been spent.
          </p>
        )}
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Actions</h2>
      <div className="mt-3">
        <CardActions id={card.id} status={card.status} />
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
