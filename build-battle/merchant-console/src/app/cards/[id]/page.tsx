import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById } from "@/data/queries"
import { CardStatus } from "@/data/types"
import { maskedNumber, MERCHANT_CATEGORY_LABELS } from "@/lib/cards"
import { formatInZone, formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { StatusControl } from "../status-control"

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
  const percent = Math.min(100, Math.round(spentRatio * 100))
  const isNearLimit = spentRatio >= 0.8

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
      <p className="mt-1 font-mono text-sm text-gray-500">{maskedNumber(card.last4)}</p>

      <div className="mt-4">
        <StatusControl cardId={card.id} status={card.status} />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Merchant category">{MERCHANT_CATEGORY_LABELS[card.category]}</Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Spend limit">{formatMoney(card.limit, card.currency)}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Spend</h2>
      <div className="mt-4 max-w-md">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)} spent
          </span>
          <span className="text-gray-500">of {formatMoney(card.limit, card.currency)}</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Spend against limit"
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              isNearLimit ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p
          className={cx(
            "mt-1.5 text-xs",
            isNearLimit ? "text-amber-600 dark:text-amber-500" : "text-gray-500",
          )}
        >
          {percent}% of limit
          {isNearLimit && " — approaching the cap"}
        </p>
      </div>

      <p className="mt-6 text-xs text-gray-500">
        Issued {formatDate(card.createdAt)}. Nothing has posted to this card yet — spend updates
        once transactions are wired up.
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">History</h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {eventLabel(event.status, index)}
              </p>
              <p className="text-sm text-gray-500">{formatInZone(event.at, merchant.timezone)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function eventLabel(status: CardStatus, index: number): string {
  if (index === 0) return "Card issued"
  switch (status) {
    case "active":
      return "Unfrozen"
    case "frozen":
      return "Frozen"
    case "cancelled":
      return "Cancelled"
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
