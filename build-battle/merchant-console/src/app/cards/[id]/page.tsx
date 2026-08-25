import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
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
  // Integer percent of the limit. Only the display rounds; the amounts do not.
  const percent = Math.min(100, Math.floor((card.spent * 100) / card.spendLimit))
  const nearLimit = percent >= 80

  return (
    <div className="p-4 sm:p-6">
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <span className="font-mono text-gray-500">{maskCard(card.last4)}</span>
          <StatusBadge status={card.status} />
        </div>
        <CardActions id={card.id} status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{card.id} · {card.reference}</p>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Spend against limit</h2>
      <p className="mt-2 text-sm tabular-nums text-gray-700 dark:text-gray-300">
        {formatMoney(card.spent, card.currency)} of{" "}
        {formatMoney(card.spendLimit, card.currency)} · {percent}% ·{" "}
        {formatMoney(card.spendLimit - card.spent, card.currency)} left
        {nearLimit && (
          <span className="ml-2 font-medium text-amber-600 dark:text-amber-500">
            Close to the limit
          </span>
        )}
      </p>
      <progress
        value={card.spent}
        max={card.spendLimit}
        aria-label={`${percent}% of spend limit used`}
        className={cx(
          "mt-2 h-2 w-full overflow-hidden rounded-full [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-800",
          nearLimit
            ? "[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500"
            : "[&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-value]:bg-blue-500",
        )}
      />

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Category">
          <span className="capitalize">{card.category}</span>
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">History</h2>
      <ol className="mt-4 space-y-4">
        {card.events.map((event, index) => (
          <li key={index} className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
            <div>
              <p className="text-sm capitalize text-gray-900 dark:text-gray-50">
                {event.type === "issued" ? "Card issued" : event.type}
              </p>
              <p className="text-sm text-gray-500">{formatInZone(event.at, merchant.timezone)}</p>
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
