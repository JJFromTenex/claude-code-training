import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardCategory } from "@/data/types"
import { maskLast4 } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  supplies: "Supplies",
}

/**
 * Tailwind cannot build a class name from a number at runtime, so the bar
 * snaps to the nearest five percent. The exact figure is written beside it.
 */
const WIDTHS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]",
  "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]",
  "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
]

/** Past this share of the limit, the bar warns rather than reassures. */
const AMBER_AT = 80

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  // Integer minor units on both sides, so the ratio is the only division here
  // and it produces a percentage rather than an amount.
  const percent = Math.min(
    100,
    Math.round((card.spent / card.spendLimit) * 100),
  )
  const remaining = card.spendLimit - card.spent
  const amber = percent >= AMBER_AT

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <StatusBadge status={card.status} />
        </div>
        <CardActions
          cardId={card.id}
          nickname={card.nickname}
          status={card.status}
        />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {card.id} · {maskLast4(card.last4)}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against the limit
      </h2>
      <div className="mt-3 max-w-md">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}
          </p>
          <p className="text-sm text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)}
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Spend against the limit, ${percent} percent`}
        >
          <div
            className={cx(
              "h-full rounded-full",
              WIDTHS[Math.round(percent / 5)],
              amber
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
          />
        </div>
        <p
          className={cx(
            "mt-2 text-sm",
            amber
              ? "text-amber-700 dark:text-amber-500"
              : "text-gray-500",
          )}
        >
          {percent}% used · {formatMoney(remaining, card.currency)} left
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Number">{maskLast4(card.last4)}</Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)} {card.currency}
        </Field>
        <Field label="Category lock">
          {card.category ? CATEGORY_LABELS[card.category] : "None"}
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
        {card.history.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {event.note}
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
