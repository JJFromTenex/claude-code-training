import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { Currency } from "@/data/types"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

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
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCard(card.last4)} · {card.id}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Remaining">
          {formatMoney(card.spendLimit - card.spent, card.currency)}
        </Field>
        <Field label="Category lock">
          {card.categoryLock ?? "No lock"}
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
        Spend
      </h2>
      <SpendProgress
        spent={card.spent}
        limit={card.spendLimit}
        currency={card.currency}
      />

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
                {entry.label}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(entry.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

/**
 * Tailwind cannot build a runtime-computed width and inline styles are
 * off-limits, so the bar snaps to 5% steps from a static class list.
 */
const WIDTHS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]",
  "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]",
  "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]",
  "w-[95%]", "w-full",
] as const

function SpendProgress({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const pct = Math.min(100, Math.round((spent / limit) * 100))
  const step = Math.min(20, Math.round((spent * 20) / limit))

  return (
    <div className="mt-4 max-w-xl">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)} of {formatMoney(limit, currency)}
        </span>
        <span className={cx(pct >= 80 ? "font-medium text-amber-600 dark:text-amber-500" : "text-gray-500")}>
          {pct}%
        </span>
      </div>
      <div
        className="mt-2 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-label="Spend against limit"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className={cx(
            "h-2 rounded-full",
            pct >= 80 ? "bg-amber-500" : "bg-emerald-600",
            WIDTHS[step],
          )}
        />
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
