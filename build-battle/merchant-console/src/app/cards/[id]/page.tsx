import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskLast4 } from "@/lib/cards"
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
  const spentRatio = card.spendLimit > 0 ? card.spent / card.spendLimit : 0
  const spentPercent = Math.min(100, Math.round(spentRatio * 100))
  const isAmber = spentRatio >= 0.8 && card.status !== "cancelled"
  const widthClass = widthClassForPercent(spentPercent)

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
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskLast4(card.last4)}</span>
        </Field>
        <Field label="Brand">
          <span className="capitalize">{card.brand}</span>
        </Field>
        <Field label="Category">
          {card.category ? (
            <span className="capitalize">{card.category}</span>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>

      {card.status === "cancelled" ? (
        <p className="mt-4 text-sm text-gray-500">
          This card is cancelled. It spent{" "}
          {formatMoney(card.spent, card.currency)} of its{" "}
          {formatMoney(card.spendLimit, card.currency)} limit before it was
          shut off, and it cannot be charged again.
        </p>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
              {formatMoney(card.spent, card.currency)}
            </span>
            <span className="text-gray-500">
              of {formatMoney(card.spendLimit, card.currency)} limit
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={`${spentPercent}% of spend limit used`}
            aria-valuenow={spentPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          >
            <div
              className={cx(
                "h-full rounded-full transition-all",
                widthClass,
                isAmber
                  ? "bg-amber-500 dark:bg-amber-500"
                  : "bg-blue-500 dark:bg-blue-500",
              )}
            />
          </div>
          {isAmber && (
            <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
              This card has used {spentPercent}% of its spend limit.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Tailwind's build-time scanner only picks up class names that appear as
 * literal text in this file, so the width is chosen from a fixed table
 * (nearest 5%) rather than interpolated — no inline `style`, still exact
 * enough for a spend bar.
 */
const WIDTH_CLASSES = [
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
  "w-1/2",
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
] as const

function widthClassForPercent(percent: number): string {
  const index = Math.min(
    WIDTH_CLASSES.length - 1,
    Math.max(0, Math.round(percent / 5)),
  )
  return WIDTH_CLASSES[index]
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
