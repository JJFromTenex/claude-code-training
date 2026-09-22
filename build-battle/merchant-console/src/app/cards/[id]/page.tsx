import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById } from "@/data/queries"
import { maskCardNumber, spendRatio } from "@/lib/cards"
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
  const ratio = spendRatio(card)
  const percent = Math.round(ratio * 100)
  const remaining = Math.max(0, card.spendLimit - card.spent)
  // Amber past 80%, which is where ops wants to know before the card declines.
  const nearLimit = ratio >= 0.8

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
        {maskCardNumber(card.last4)}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-4 max-w-md">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
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
          aria-label={`Spend against limit: ${percent}%`}
        >
          <div
            className={cx(
              "h-full rounded-full",
              nearLimit
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p
          className={cx(
            "mt-2 text-sm",
            nearLimit
              ? "text-amber-600 dark:text-amber-500"
              : "text-gray-500",
          )}
        >
          {percent}% used · {formatMoney(remaining, card.currency)} remaining
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Card">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
        <Field label="Reference">
          <span className="font-mono text-xs">{card.reference}</span>
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Card ID">
          <span className="font-mono text-sm">{card.id}</span>
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
