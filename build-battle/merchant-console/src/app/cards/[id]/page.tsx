import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById, spendForCard } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardStatus, MerchantCategory } from "@/data/types"
import { maskedNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const EVENT_LABELS: Record<CardStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  any: "No lock",
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
}

/** Amber past 80%, red once the limit is gone. */
function barTone(percent: number) {
  if (percent >= 100) return "bg-red-500 dark:bg-red-500"
  if (percent >= 80) return "bg-amber-500 dark:bg-amber-500"
  return "bg-blue-500 dark:bg-blue-500"
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const spent = spendForCard(card)
  // Integer math on minor units; only the bar width is a float, and it is
  // never stored or compared.
  const percent = Math.min(100, Math.round((spent / card.spendLimit) * 100))
  const remaining = Math.max(0, card.spendLimit - spent)

  return (
    <section aria-label={`Card ${card.nickname}`} className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        ← Cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
              {card.nickname}
            </h1>
            <CardStatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">
            {maskedNumber(card.last4)}
          </p>
        </div>
        <CardActions
                    cardId={card.id}
                    nickname={card.nickname}
                    status={card.status}
                  />
      </div>

      <Divider />

      <div className="max-w-xl">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Spend against limit
          </h2>
          <p className="text-sm tabular-nums text-gray-500">
            {percent}% used
          </p>
        </div>

        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Spend against limit"
        >
          <div
            className={cx("h-full rounded-full", barTone(percent))}
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-2 flex justify-between text-sm">
          <span className="tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(spent, card.currency)} spent
          </span>
          <span className="tabular-nums text-gray-500">
            {formatMoney(remaining, card.currency)} left of{" "}
            {formatMoney(card.spendLimit, card.currency)}
          </span>
        </div>

        <p className="mt-2 text-xs text-gray-500">
          Payments in this codebase carry no card reference, so spend is
          attributed by the card&apos;s merchant and currency. Treat it as
          indicative rather than a statement.
        </p>
      </div>

      <Divider />

      <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gray-500">Merchant</dt>
          <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-50">
            {merchant?.name ?? card.merchantId}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Spend limit</dt>
          <dd className="mt-0.5 text-sm tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spendLimit, card.currency)} {card.currency}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Category lock</dt>
          <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-50">
            {CATEGORY_LABELS[card.categoryLock]}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Card ID</dt>
          <dd className="mt-0.5 font-mono text-sm text-gray-900 dark:text-gray-50">
            {card.id}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Created</dt>
          <dd className="mt-0.5 text-sm text-gray-900 dark:text-gray-50">
            {merchant
              ? formatInZone(card.createdAt, merchant.timezone)
              : card.createdAt}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Full number</dt>
          <dd className="mt-0.5 text-sm text-gray-500">
            Shown once at issue. Not stored.
          </dd>
        </div>
      </dl>

      <Divider />

      <div className="max-w-xl">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          History
        </h2>
        <p className="mt-0.5 text-xs text-gray-500">
          Every status change on this card, oldest first.
        </p>
        <ol className="mt-3 flex flex-col gap-2">
          {card.history.map((event, index) => (
            <li
              key={`${event.at}-${index}`}
              className="flex items-baseline justify-between gap-4 text-sm"
            >
              <span className="text-gray-900 dark:text-gray-50">
                {event.from === null
                  ? "Issued"
                  : `${EVENT_LABELS[event.from]} → ${EVENT_LABELS[event.to]}`}
              </span>
              <span className="shrink-0 tabular-nums text-gray-500">
                {merchant
                  ? formatInZone(event.at, merchant.timezone)
                  : event.at}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
