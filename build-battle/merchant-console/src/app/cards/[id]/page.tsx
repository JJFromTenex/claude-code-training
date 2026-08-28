import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskedNumber, spendState } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CancelCard } from "./cancel-card"

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
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const zone = merchant?.timezone ?? "UTC"
  const spend = spendState(card.spent, card.spendLimit)

  return (
    <section aria-label="Card detail" className="px-4 py-6 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-blue-600 hover:underline dark:text-blue-500"
      >
        Back to cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="mt-1 font-mono text-sm tabular-nums text-gray-500">
            {maskedNumber(card.last4)}
          </p>
        </div>
        <CardStatusBadge status={card.status} />
      </div>

      <Divider />

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Record
          </h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Card ID</dt>
              <dd className="font-mono text-gray-900 dark:text-gray-50">{card.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Merchant</dt>
              <dd className="text-gray-900 dark:text-gray-50">
                {merchant?.name ?? card.merchantId}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Currency</dt>
              <dd className="text-gray-900 dark:text-gray-50">{card.currency}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Category lock</dt>
              <dd className="text-gray-900 dark:text-gray-50">
                {card.categoryLock
                  ? CATEGORY_LABELS[card.categoryLock]
                  : "None"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Issued</dt>
              <dd className="text-gray-900 dark:text-gray-50">
                {formatInZone(card.createdAt, zone)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Spend
          </h2>
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                {formatMoney(card.spent, card.currency)}
              </span>
              <span className="text-sm text-gray-500">
                of {formatMoney(card.spendLimit, card.currency)}
              </span>
            </div>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
              role="progressbar"
              aria-valuenow={Math.round(spend.percent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Spend against limit"
            >
              <div
                className={cx(
                  "h-full rounded-full",
                  spend.warn
                    ? "bg-amber-500 dark:bg-amber-400"
                    : "bg-blue-500 dark:bg-blue-500",
                )}
                style={{ width: `${spend.percent}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {formatMoney(spend.remaining, card.currency)} remaining.{" "}
              {card.spent === 0
                ? "Spend accrues when transactions post against the card."
                : `${Math.round(spend.percent)}% of the limit used.`}
            </p>
          </div>

          {card.status !== "cancelled" && (
            <>
              <Divider />
              <CancelCard id={card.id} />
            </>
          )}
        </div>
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-3 flex flex-col gap-2 text-sm">
        {card.history.map((event, index) => (
          <li key={`${event.at}-${index}`} className="flex justify-between gap-4">
            <span className="text-gray-900 dark:text-gray-50">
              {event.from === null
                ? "Issued as active"
                : `${event.from} to ${event.to}`}
            </span>
            <span className="text-gray-500">{formatInZone(event.at, zone)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
