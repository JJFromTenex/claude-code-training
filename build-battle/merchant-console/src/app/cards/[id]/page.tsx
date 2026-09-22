import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, isSpendHigh, maskCard, spendPercent } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusControls } from "./status-controls"

// Literal Tailwind width classes so the progress bar stays Tailwind-only (no
// inline styles). Spend is snapped to the nearest twelfth of the limit.
const WIDTHS = [
  "w-0", "w-1/12", "w-2/12", "w-3/12", "w-4/12", "w-5/12", "w-6/12",
  "w-7/12", "w-8/12", "w-9/12", "w-10/12", "w-11/12", "w-full",
] as const

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const pct = spendPercent(card.spend, card.limit)
  const overThreshold = isSpendHigh(card.spend, card.limit)
  const twelfth = Math.min(12, Math.round((pct / 100) * 12))

  return (
    <section aria-label={`Card ${card.nickname}`} className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← All cards
      </Link>

      <div className="mt-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="mt-0.5 font-mono tabular-nums text-gray-500">
            {maskCard(card.last4)}
          </p>
        </div>
        <CardStatusBadge status={card.status} />
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Merchant" value={merchant?.name ?? card.merchantId} />
        <Field label="Category" value={CARD_CATEGORY_LABELS[card.category]} />
        <Field label="Currency" value={card.currency} />
        <Field label="Spend limit" value={formatMoney(card.limit, card.currency)} />
        <Field label="Spent" value={formatMoney(card.spend, card.currency)} />
        <Field label="Created" value={formatDate(card.createdAt)} />
        <Field label="Reference" value={card.reference} />
      </dl>

      <div className="mt-8 max-w-md">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-gray-50">
            Spend against limit
          </span>
          <span className="tabular-nums text-gray-500">
            {formatMoney(card.spend, card.currency)} of{" "}
            {formatMoney(card.limit, card.currency)} ({Math.round(pct)}%)
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className={cx(
              "h-2 rounded-full",
              WIDTHS[twelfth],
              overThreshold ? "bg-amber-500" : "bg-emerald-500",
            )}
          />
        </div>
        {overThreshold && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            This card is past 80% of its limit.
          </p>
        )}
      </div>

      <div className="mt-8">
        <CardStatusControls id={card.id} status={card.status} />
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 font-medium text-gray-900 dark:text-gray-50">{value}</dd>
    </div>
  )
}
