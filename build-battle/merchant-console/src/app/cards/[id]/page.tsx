import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/card-queries"
import { merchantById } from "@/data/merchants"
import { maskCardNumber, SPEND_AMBER_AT, spendPercentage } from "@/lib/cards"
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

  const merchant = merchantById(card.merchantId)
  const percent = spendPercentage(card.spent, card.spendLimit)
  const amber = percent >= SPEND_AMBER_AT
  const remaining = card.spendLimit - card.spent

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        &larr; All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 max-w-md">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}
          </p>
          <p className="text-sm tabular-nums text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)}
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Spend against limit, ${percent} percent used`}
        >
          {/* Width is runtime data, which Tailwind cannot express at build
              time. The charts and Drawer use inline style for the same reason. */}
          <div
            className={cx(
              "h-full rounded-full",
              amber ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
        <p
          className={cx(
            "mt-1.5 text-sm tabular-nums",
            amber ? "text-amber-600 dark:text-amber-500" : "text-gray-500",
          )}
        >
          {percent}% used · {formatMoney(remaining, card.currency)} remaining
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
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Network reference">
          <span className="font-mono text-xs">{card.reference}</span>
        </Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
        <Field label="Issued (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        {merchant && (
          <Field label={`Issued (${merchant.timezone})`}>
            {formatInZone(card.createdAt, merchant.timezone)}
          </Field>
        )}
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
