import { Button } from "@/components/Button"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById } from "@/data/queries"
import { maskCardNumber, spendRatio } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { CardActions } from "../card-actions"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)

  if (!card) {
    return (
      <section aria-label="Card not found" className="px-4 py-16 text-center sm:p-16">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
          No card with that id
        </h1>
        <p className="mt-1 text-gray-500">
          It may have been issued against a different environment — the store
          resets when the dev server restarts.
        </p>
        <Button variant="secondary" className="mt-6 py-1.5" asChild>
          <Link href="/cards">Back to cards</Link>
        </Button>
      </section>
    )
  }

  const merchant = merchantById(card.merchantId)
  const ratio = spendRatio(card)
  const percent = Math.round(ratio * 100)
  const remaining = Math.max(card.spendLimit - card.spent, 0)
  const heavy = ratio >= 0.8

  return (
    <section aria-label={`Card ${card.nickname}`} className="px-4 py-6 sm:p-6">
      <Link
        href="/cards"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-gray-500">
            <span className="font-mono">{maskCardNumber(card.last4)}</span>
            <StatusBadge status={card.status} />
          </p>
        </div>
        <CardActions cardId={card.id} status={card.status} />
      </div>

      <div className="mt-8 max-w-xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Spend against limit
          </h2>
          <p className="text-sm tabular-nums text-gray-500">
            {formatMoney(card.spent, card.currency)} of{" "}
            {formatMoney(card.spendLimit, card.currency)}
          </p>
        </div>
        <div
          className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of the spend limit used`}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              heavy ? "bg-amber-500 dark:bg-amber-400" : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className={cx("mt-2 text-sm", heavy ? "text-amber-700 dark:text-amber-500" : "text-gray-500")}>
          {percent}% used · {formatMoney(remaining, card.currency)} remaining
          {heavy && card.status !== "cancelled" ? " — close to the limit" : ""}
        </p>
      </div>

      <dl className="mt-10 grid max-w-xl grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        {(
          [
            ["Merchant", merchant?.name ?? card.merchantId],
            ["Category lock", card.category ? CATEGORY_LABELS[card.category] : "None"],
            ["Card id", card.id],
            ["Number reference", card.reference],
            ["Issued", formatInZone(card.createdAt, merchant?.timezone ?? "UTC")],
            ["Currency", card.currency],
          ] as const
        ).map(([term, value]) => (
          <div key={term}>
            <dt className="text-sm text-gray-500">{term}</dt>
            <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-10 max-w-xl">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">History</h2>
        <ol className="mt-3 space-y-2">
          {card.events.map((event, i) => (
            <li key={`${event.at}-${i}`} className="flex justify-between gap-4 text-sm">
              <span className="text-gray-900 dark:text-gray-50">
                {event.from === null
                  ? "Issued"
                  : `${event.from} → ${event.to}`}
              </span>
              <span className="text-gray-500">
                {formatInZone(event.at, merchant?.timezone ?? "UTC")}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
