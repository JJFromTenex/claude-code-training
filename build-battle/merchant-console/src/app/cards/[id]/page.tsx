import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { CATEGORY_LABELS, cardById, eventsForCard } from "@/data/cards"
import { CardEvent } from "@/data/types"
import { merchantById } from "@/data/merchants"
import { maskCardNumber, spendRatio } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const events = eventsForCard(card.id)
  const ratio = spendRatio(card.spend, card.spendLimit)
  const percent = Math.round(ratio * 100)
  const remaining = Math.max(0, card.spendLimit - card.spend)
  const nearLimit = ratio >= 0.8

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
        <CardStatusBadge status={card.status} />
        <div className="ml-auto">
          <CardActions
            cardId={card.id}
            cardNickname={card.nickname}
            status={card.status}
          />
        </div>
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-xl">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(card.spend, card.currency)}
          </p>
          <p className="text-sm text-gray-500 tabular-nums">
            of {formatMoney(card.spendLimit, card.currency)} {card.currency}
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Spend is ${percent} percent of the limit`}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              nearLimit
                ? "bg-amber-500 dark:bg-amber-400"
                : "bg-blue-500 dark:bg-blue-500",
              widthClass(ratio),
            )}
          />
        </div>
        <p
          className={cx(
            "mt-2 text-sm tabular-nums",
            nearLimit
              ? "text-amber-700 dark:text-amber-500"
              : "text-gray-500",
          )}
        >
          {percent}% used · {formatMoney(remaining, card.currency)} remaining
          {nearLimit && " · close to the limit"}
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
          <span className="ml-2 text-xs text-gray-500">
            shown in full once, at issue
          </span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)} {card.currency}
          </span>
        </Field>
        <Field label="Category lock">
          {card.category ? CATEGORY_LABELS[card.category] : "None"}
        </Field>
        <Field label="Status">
          <CardStatusBadge status={card.status} />
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
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <span
              className={cx(
                "mt-1.5 size-2 shrink-0 rounded-full",
                EVENT_DOTS[event.type],
              )}
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[event.type]}
                <span className="ml-2 text-gray-500">{event.actor}</span>
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {card.status === "cancelled" && (
        <>
          <Divider />
          <p className="text-sm text-gray-500">
            This card is cancelled. Cancellation is permanent — issue a new card
            rather than trying to restore this one.
          </p>
        </>
      )}
    </div>
  )
}

const EVENT_LABELS: Record<CardEvent["type"], string> = {
  issued: "Card issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
}

const EVENT_DOTS: Record<CardEvent["type"], string> = {
  issued: "bg-emerald-600 dark:bg-emerald-400",
  frozen: "bg-blue-500",
  unfrozen: "bg-emerald-600 dark:bg-emerald-400",
  cancelled: "bg-gray-500",
}

/**
 * Tailwind only, per `.claude/rules/components.md` — no inline `style`.
 * Tailwind's JIT needs class names it can see at build time, so the bar
 * snaps to the nearest 5%. That is finer than the bar can render anyway.
 */
const WIDTHS = [
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
] as const

function widthClass(ratio: number): string {
  return WIDTHS[Math.round(ratio * 20)]
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
