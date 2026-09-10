import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CardEvent, CardStatus } from "@/data/types"
import { isNearLimit, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

// Tailwind needs each width class spelled out literally somewhere in the
// source to generate it; a template string built from a raw percentage
// would not be picked up. Widths snap to the nearest 5% so every value the
// bar can render already exists as a real class.
const WIDTH_CLASSES = [
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

function widthClassForPercent(percent: number) {
  const index = Math.min(20, Math.max(0, Math.round(percent / 5)))
  return WIDTH_CLASSES[index]
}

const STATUS_LABELS: Record<CardStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

function eventLabel(event: CardEvent) {
  if (event.from === null) return "Card issued"
  return `${STATUS_LABELS[event.from]} → ${STATUS_LABELS[event.to]}`
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
  const near = isNearLimit(card.spent, card.spendLimit)
  const percent =
    card.spendLimit > 0
      ? Math.min(100, Math.round((card.spent / card.spendLimit) * 100))
      : 0
  const events = [...card.events].sort((a, b) => a.at.localeCompare(b.at))

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
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
        <Field label="Category">
          <span className="capitalize">{card.category}</span>
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <div>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
            Spend
          </h2>
          <p className="text-sm text-gray-500">
            {formatMoney(card.spent, card.currency)} of{" "}
            {formatMoney(card.spendLimit, card.currency)} spent ({percent}%)
          </p>
        </div>
        <div
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of the spend limit used`}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              near ? "bg-amber-500 dark:bg-amber-500" : "bg-blue-500 dark:bg-blue-500",
              widthClassForPercent(percent),
            )}
          />
        </div>
        {near && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
            Nearing the spend limit.
          </p>
        )}
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Audit trail
      </h2>
      <ol className="mt-4 space-y-4">
        {events.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {eventLabel(event)}
              </p>
              <p className="text-sm text-gray-500">
                {formatInZone(event.at, merchant.timezone)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <Divider />

      <CardActions card={card} />
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
