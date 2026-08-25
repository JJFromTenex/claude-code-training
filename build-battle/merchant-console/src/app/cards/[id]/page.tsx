import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEventType } from "@/data/types"
import { SPEND_WARNING_RATIO, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const EVENT_LABELS: Record<CardEventType, string> = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
}

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

/**
 * Bar widths as literal classes, so Tailwind compiles them and the page needs
 * no inline style. Five-percent steps are finer than the eye reads on a bar.
 */
const BAR_WIDTHS = [
  "w-[0%]", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]",
  "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]",
  "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]",
  "w-[90%]", "w-[95%]", "w-[100%]",
]

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const remaining = card.spendLimit - card.spend
  const ratio = card.spendLimit > 0 ? card.spend / card.spendLimit : 0
  const nearLimit = ratio >= SPEND_WARNING_RATIO
  const widthClass = BAR_WIDTHS[Math.min(20, Math.max(0, Math.round(ratio * 20)))]

  const timeline = [...card.events].sort((a, b) => a.at.localeCompare(b.at))

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

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-xl">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spend, card.currency)}
          </p>
          <p className="text-sm text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)}
          </p>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Spend against limit"
        >
          <div
            className={cx(
              "h-full rounded-full",
              widthClass,
              nearLimit
                ? "bg-amber-500 dark:bg-amber-500"
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
          {Math.round(ratio * 100)}% used ·{" "}
          {formatMoney(Math.max(0, remaining), card.currency)} remaining
          {nearLimit && " — close to the limit"}
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-xs">{card.reference}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Category lock">
          {card.categoryLock ? CATEGORY_LABELS[card.categoryLock] : "None"}
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Actions
      </h2>
      <div className="mt-4">
        <CardActions cardId={card.id} status={card.status} />
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {timeline.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[event.type]}
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
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
