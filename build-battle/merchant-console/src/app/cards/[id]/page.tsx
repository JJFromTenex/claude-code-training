import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { CardEventType } from "@/data/types"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const EVENT_LABELS: Record<CardEventType, string> = {
  issued: "Card issued",
  frozen: "Card frozen",
  unfrozen: "Card unfrozen",
  cancelled: "Card cancelled",
}

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = store.cards.find((c) => c.id === id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!

  // Fraction of integer minor units — never a division by 100 outside a
  // formatter. The *100 below is percentage-width math for the bar only.
  const ratio =
    card.limitMinorUnits > 0 ? card.spentMinorUnits / card.limitMinorUnits : 0
  const percent = Math.min(100, ratio * 100)
  const barColor =
    ratio >= 1
      ? "bg-red-500 dark:bg-red-500"
      : ratio > 0.8
        ? "bg-amber-500 dark:bg-amber-500"
        : "bg-emerald-500 dark:bg-emerald-500"

  const timeline = [...card.events].sort((a, b) => a.at.localeCompare(b.at))

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← Back to cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
          {card.nickname}
        </h1>
        <StatusBadge status={card.status} />
        <span className="font-mono text-sm text-gray-500">
          {maskCard(card.last4)}
        </span>
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Category">
          <span className="capitalize">{card.category}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Limit">
          {formatMoney(card.limitMinorUnits, card.currency)}
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Number reference">
          <span className="font-mono text-sm">{card.numberRef}</span>
        </Field>
        <Field label="Card ID">
          <span className="font-mono text-sm">{card.id}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        {formatMoney(card.spentMinorUnits, card.currency)} of{" "}
        {formatMoney(card.limitMinorUnits, card.currency)} spent
      </p>
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend against limit"
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx("h-full rounded-full", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Timeline
      </h2>
      <ol className="mt-4 space-y-4">
        {timeline.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {EVENT_LABELS[entry.type]}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(entry.at, merchant.timezone)}
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
