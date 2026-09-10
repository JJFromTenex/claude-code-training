import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCard, spendPercent } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../card-status-actions"
import { CATEGORY_LABELS } from "../categories"

const HISTORY_LABELS: Record<string, string> = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
}

/**
 * Bar widths in 5% steps.
 *
 * Written out rather than interpolated because Tailwind only ships classes
 * it can see in the source, and the rules here are Tailwind-only — no inline
 * style attribute for a dynamic width.
 */
const WIDTHS: Record<number, string> = {
  0: "w-0",
  5: "w-[5%]",
  10: "w-[10%]",
  15: "w-[15%]",
  20: "w-[20%]",
  25: "w-[25%]",
  30: "w-[30%]",
  35: "w-[35%]",
  40: "w-[40%]",
  45: "w-[45%]",
  50: "w-[50%]",
  55: "w-[55%]",
  60: "w-[60%]",
  65: "w-[65%]",
  70: "w-[70%]",
  75: "w-[75%]",
  80: "w-[80%]",
  85: "w-[85%]",
  90: "w-[90%]",
  95: "w-[95%]",
  100: "w-full",
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
  const percent = spendPercent(card)
  const remaining = Math.max(0, card.spendLimit - card.spent)
  // Amber past 80%: the point where ops wants to know before the card declines.
  const nearLimit = percent >= 80

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
        {maskCard(card.last4)} · {card.id}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-xl">
        <div className="flex items-baseline justify-between tabular-nums">
          <span className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}
          </span>
          <span className="text-sm text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)}
          </span>
        </div>

        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of the spend limit used`}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              WIDTHS[Math.round(percent / 5) * 5],
              nearLimit
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-blue-500 dark:bg-blue-500",
            )}
          />
        </div>

        <p
          className={cx(
            "mt-2 text-sm",
            nearLimit
              ? "text-amber-600 dark:text-amber-500"
              : "text-gray-500",
          )}
        >
          {percent}% used ·{" "}
          {formatMoney(remaining, card.currency)} remaining
          {nearLimit && " · close to the limit"}
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Number">
          <span className="font-mono">{maskCard(card.last4)}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category lock">
          {CATEGORY_LABELS[card.category]}
        </Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
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
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className={cx(
                "mt-1.5 size-2 shrink-0 rounded-full",
                event.action === "cancelled"
                  ? "bg-gray-400 dark:bg-gray-600"
                  : "bg-blue-500",
              )}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm capitalize text-gray-900 dark:text-gray-50">
                {HISTORY_LABELS[event.action]}
                {event.detail && (
                  <span className="ml-2 font-normal normal-case text-gray-500">
                    {event.detail}
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

      {card.status === "cancelled" && (
        <p className="mt-6 text-sm text-gray-500">
          This card is cancelled. Cancelled is terminal — issue a new card
          rather than reactivating this one.
        </p>
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
