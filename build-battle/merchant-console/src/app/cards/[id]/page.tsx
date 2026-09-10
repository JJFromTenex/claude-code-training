import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { CATEGORY_LABELS, maskCardNumber, spendTone } from "@/data/cardRules"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEvent } from "@/data/types"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"

export const dynamic = "force-dynamic"

const EVENT_LABELS = (event: CardEvent) => {
  if (event.from === null) return "Issued"
  if (event.to === "frozen") return "Frozen"
  if (event.to === "cancelled") return "Cancelled"
  return "Unfrozen"
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const tone = spendTone(card.spent, card.spendLimit)
  // Whole percent for the label only; the bar and the tone use minor units.
  const percent = Math.floor((card.spent * 100) / card.spendLimit)

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
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <div className="mt-6">
        <CardStatusActions
          cardId={card.id}
          nickname={card.nickname}
          status={card.status}
          allowCancel
        />
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-3 max-w-xl">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)} of{" "}
            {formatMoney(card.spendLimit, card.currency)}
          </span>
          <span
            className={cx(
              "tabular-nums",
              tone === "warning"
                ? "font-medium text-amber-600 dark:text-amber-500"
                : "text-gray-500",
            )}
          >
            {percent}% used
          </span>
        </div>
        <progress
          value={card.spent}
          max={card.spendLimit}
          aria-label={`Spend against limit: ${percent}% used`}
          className={cx(
            "mt-2 h-2 w-full appearance-none overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
            "[&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-800",
            tone === "warning"
              ? "[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500"
              : "[&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-value]:bg-blue-500",
          )}
        />
        <p className="mt-2 text-sm text-gray-500">
          {formatMoney(card.spendLimit - card.spent, card.currency)} remaining.
          No transactions are linked to virtual cards yet, so spend starts at
          zero rather than being estimated.
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Merchant category lock">
          {CATEGORY_LABELS[card.category]}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Number reference">
          <span className="break-all font-mono text-sm">{card.numberRef}</span>
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Status history
      </h2>
      <ol className="mt-4 space-y-4">
        {[...card.history].reverse().map((event) => (
          <li key={`${event.at}-${event.to}`} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS(event)}
                {event.from && (
                  <span className="text-gray-500">
                    {" "}
                    · {event.from} → {event.to}
                  </span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>
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
