import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardStatus } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatDate, formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusActions } from "../status-actions"

/** How a status reads in the history list, where it is a past event. */
const LABELS: Record<CardStatus, string> = {
  active: "Unfrozen",
  frozen: "Frozen",
  cancelled: "Cancelled",
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
  const remaining = card.limit - card.spent

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
      <p className="mt-1 font-mono text-sm tabular-nums text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <SpendAgainstLimit
        spent={card.spent}
        limit={card.limit}
        currency={card.currency}
      />

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">{merchant?.name ?? card.merchantId}</Field>
        <Field label="Card number">
          <span className="font-mono tabular-nums">
            {maskCardNumber(card.last4)}
          </span>
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.limit, card.currency)} {card.currency}
          </span>
        </Field>
        <Field label="Spent">
          <span className="tabular-nums">
            {formatMoney(card.spent, card.currency)}
          </span>
        </Field>
        <Field label="Remaining">
          <span className="tabular-nums">
            {formatMoney(remaining, card.currency)}
          </span>
        </Field>
        <Field label="Category lock">{card.category ?? "Unrestricted"}</Field>
        <Field label="Number reference">
          <span className="font-mono text-xs">{card.reference}</span>
        </Field>
        <Field label="Created (UTC)">{formatDate(card.createdAt)}</Field>
        {merchant && (
          <Field label={`Created (${merchant.timezone})`}>
            {formatInZone(card.createdAt, merchant.timezone)}
          </Field>
        )}
      </dl>

      <Divider />

      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-3 space-y-2">
        {card.history.map((event, index) => (
          <li key={`${event.at}-${index}`} className="flex items-baseline gap-3">
            <span
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-gray-300 dark:bg-gray-700"
              aria-hidden="true"
            />
            <span className="text-sm text-gray-900 dark:text-gray-50">
              {index === 0 ? "Issued" : LABELS[event.status]}
            </span>
            <span className="text-sm text-gray-500">
              {formatDate(event.at)}
              {merchant && ` · ${formatInZone(event.at, merchant.timezone)}`}
            </span>
          </li>
        ))}
      </ol>

      <Divider />

      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        Card controls
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {card.status === "cancelled"
          ? "This card is cancelled. Cancellation is permanent — issue a new card instead."
          : "Freezing blocks new authorisations and can be undone. Cancelling cannot."}
      </p>
      <div className="mt-3">
        <CardStatusActions cardId={card.id} status={card.status} size="full" />
      </div>
    </div>
  )
}

/**
 * Bar widths as literal classes, so Tailwind can see them at build time and
 * the bar needs no inline style. Snapped to 5%, which is finer than the eye
 * reads a 2px bar.
 */
const BAR_WIDTHS = [
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
  "w-[50%]",
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
]

/**
 * Spend against the limit. The bar turns amber past 80% so a card about to
 * run out is visible without reading the numbers.
 */
function SpendAgainstLimit({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: "USD" | "EUR" | "GBP"
}) {
  const percent = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const nearLimit = percent >= 80

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Spend against limit
        </h2>
        <p className="text-sm tabular-nums text-gray-500">
          {formatMoney(spent, currency)} of {formatMoney(limit, currency)} ·{" "}
          {percent.toFixed(0)}%
        </p>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend against limit"
      >
        <div
          className={cx(
            "h-full rounded-full",
            nearLimit
              ? "bg-amber-500 dark:bg-amber-400"
              : "bg-blue-500 dark:bg-blue-500",
            BAR_WIDTHS[Math.round(percent / 5)],
          )}
        />
      </div>
      {nearLimit && (
        <p className="mt-1.5 text-sm text-amber-700 dark:text-amber-500">
          Past 80% of the limit.
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
      <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
