import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { CARD_CATEGORIES, cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { cx } from "@/lib/utils"
import { formatDate } from "@/lib/dates"
import { maskCardNumber } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
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
  const spentRatio = card.limit > 0 ? card.spent / card.limit : 0
  const spentPercent = Math.min(100, Math.round(spentRatio * 100))
  const isNearLimit = spentRatio >= 0.8
  const categoryLabel = card.category
    ? CARD_CATEGORIES.find((c) => c.value === card.category)?.label
    : null

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

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category">{categoryLabel ?? "—"}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.limit, card.currency)}
        </Field>
        <Field label="Spent">
          {formatMoney(card.spent, card.currency)} of{" "}
          {formatMoney(card.limit, card.currency)} spent
        </Field>
        <Field label="Created">{formatDate(card.createdAt)}</Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend progress
      </h2>
      <div className="mt-3 max-w-md">
        <div
          role="progressbar"
          aria-valuenow={spentPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Spend against limit"
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              isNearLimit
                ? "bg-amber-500 dark:bg-amber-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${spentPercent}%` }}
          />
        </div>
        <p className="mt-2 text-sm text-gray-500">
          {formatMoney(card.spent, card.currency)} of{" "}
          {formatMoney(card.limit, card.currency)} spent ({spentPercent}%)
        </p>
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
