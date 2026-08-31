import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

/**
 * Tailwind cannot build a class from a runtime value and inline styles are out
 * per the components rule, so the bar snaps to 5% steps. The exact figure sits
 * in the label next to it.
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
  const remaining = Math.max(0, card.spendLimit - card.spent)
  const percent =
    card.spendLimit > 0
      ? Math.min(100, Math.round((card.spent / card.spendLimit) * 100))
      : 0
  const nearLimit = percent > 80

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
        {card.id} · {maskCardNumber(card.last4)}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm text-gray-900 dark:text-gray-50">
            <span className="font-semibold tabular-nums">
              {formatMoney(card.spent, card.currency)}
            </span>
            <span className="text-gray-500">
              {" "}
              of {formatMoney(card.spendLimit, card.currency)}
            </span>
          </p>
          <p
            className={cx(
              "text-sm font-medium tabular-nums",
              nearLimit
                ? "text-amber-600 dark:text-amber-500"
                : "text-gray-500",
            )}
          >
            {percent}%
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Spend against limit for ${card.nickname}`}
        >
          <div
            className={cx(
              "h-full rounded-full",
              BAR_WIDTHS[Math.round(percent / 5)],
              nearLimit
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {formatMoney(remaining, card.currency)} remaining
          {nearLimit && " · past 80% of the limit"}
        </p>
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
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category lock">
          {CARD_CATEGORY_LABELS[card.categoryLock]}
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Spent">{formatMoney(card.spent, card.currency)}</Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        {merchant && (
          <Field label={`Created (${merchant.timezone})`}>
            {formatInZone(card.createdAt, merchant.timezone)}
          </Field>
        )}
        <Field label="Number reference">
          <span className="font-mono text-sm">{card.numberRef}</span>
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
