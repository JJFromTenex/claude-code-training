import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { cardById, eventsForCard } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEventType } from "@/data/types"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardRowActions } from "../row-actions"

const EVENT_LABELS: Record<CardEventType, string> = {
  issued: "Issued",
  frozen: "Frozen",
  unfrozen: "Unfrozen",
  cancelled: "Cancelled",
}

/**
 * Tailwind only, so the bar's width is a class, not an inline style. The tokens
 * stay literal here or the scanner never emits them. Rounded to five percent;
 * the exact figure is written beside the bar.
 */
const BAR_WIDTHS = (
  "w-[0%] w-[5%] w-[10%] w-[15%] w-[20%] w-[25%] w-[30%] w-[35%] w-[40%] " +
  "w-[45%] w-[50%] w-[55%] w-[60%] w-[65%] w-[70%] w-[75%] w-[80%] w-[85%] " +
  "w-[90%] w-[95%] w-[100%]"
).split(" ")

/** Any spend at all shows something, so a card at 1% does not read as untouched. */
const barWidth = (percent: number) =>
  BAR_WIDTHS[percent > 0 ? Math.max(1, Math.round(percent / 5)) : 0]

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
  const percent = (card.spent / card.spendLimit) * 100
  const capped = Math.min(100, percent)
  const nearLimit = percent > 80

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
        <span className="font-mono text-sm text-gray-500">
          {maskCard(card.last4)}
        </span>
        <div className="ml-auto">
          <CardRowActions cardId={card.id} status={card.status} />
        </div>
      </div>
      <Divider />
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">{formatMoney(card.spendLimit, card.currency)}</span>
        </Field>
        <Field label="Spent">
          <span className="tabular-nums">{formatMoney(card.spent, card.currency)}</span>
        </Field>
        <Field label="Category lock">
          <span className="capitalize">{card.categoryLock ?? "—"}</span>
        </Field>
        <Field label="Created (UTC)">{formatInZone(card.createdAt, "UTC")}</Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>
      <Divider />
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 flex items-center gap-4">
        <div
          role="progressbar"
          aria-label="Spend against limit"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(capped)}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full",
              nearLimit ? "bg-amber-500" : "bg-blue-500",
              barWidth(capped),
            )}
          />
        </div>
        <span
          className={cx(
            "shrink-0 text-sm font-medium tabular-nums",
            nearLimit ? "text-amber-600 dark:text-amber-500" : "text-gray-900 dark:text-gray-50",
          )}
        >
          {percent.toFixed(1)}%
        </span>
      </div>
      <p className="mt-2 text-sm text-gray-500">
        {formatMoney(card.spent, card.currency)} of{" "}
        {formatMoney(card.spendLimit, card.currency)} spent
        {nearLimit ? " — past 80% of the limit." : "."}
      </p>
      <Divider />
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Audit trail
      </h2>
      <ol className="mt-4 space-y-4">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[event.type]}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
              {event.detail && <p className="mt-1 text-sm text-gray-500">{event.detail}</p>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
