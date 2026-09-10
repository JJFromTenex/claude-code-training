import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/card-queries"
import { merchantById } from "@/data/merchants"
import { maskCardNumber, spendRatio } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-actions"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const ratio = spendRatio(card)
  const percent = Math.round(ratio * 100)
  const nearLimit = ratio >= 0.8
  const remaining = Math.max(0, card.spendLimit - card.spend)

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
        <div className="ml-auto">
          <CardStatusActions id={card.id} status={card.status} />
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-sm tabular-nums text-gray-900 dark:text-gray-50">
            <span className="font-semibold">
              {formatMoney(card.spend, card.currency)}
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
              nearLimit
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {nearLimit
            ? `${formatMoney(remaining, card.currency)} left before this card stops working.`
            : `${formatMoney(remaining, card.currency)} remaining.`}
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant?.name ?? card.merchantId}
          {merchant && <span className="ml-2 text-gray-500">{merchant.country}</span>}
        </Field>
        <Field label="Number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Category lock">
          {card.category ? CATEGORY_LABELS[card.category] : "None"}
        </Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        {merchant && (
          <Field label={`Created (${merchant.timezone})`}>
            {formatInZone(card.createdAt, merchant.timezone)}
          </Field>
        )}
      </dl>

      {card.status === "cancelled" && (
        <>
          <Divider />
          <p className="text-sm text-gray-500">
            This card was cancelled. Cancelling is permanent — issue a new card
            rather than trying to restore this one.
          </p>
        </>
      )}
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
