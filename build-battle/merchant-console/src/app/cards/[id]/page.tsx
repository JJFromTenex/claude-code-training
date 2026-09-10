import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById } from "@/data/queries"
import { maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!
  const remaining = card.spendLimit - card.spent
  const percent =
    card.spendLimit > 0
      ? Math.min(100, Math.round((card.spent / card.spendLimit) * 100))
      : 0
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
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCardNumber(card.last4)} · {card.id}
      </p>

      <Divider />

      <section aria-labelledby="spend-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="spend-heading"
            className="text-sm font-semibold text-gray-900 dark:text-gray-50"
          >
            Spend against limit
          </h2>
          <p className="text-sm tabular-nums text-gray-500">
            <span
              className={cx(
                "font-medium",
                nearLimit
                  ? "text-orange-600 dark:text-orange-500"
                  : "text-gray-900 dark:text-gray-50",
              )}
            >
              {formatMoney(card.spent, card.currency)}
            </span>{" "}
            of {formatMoney(card.spendLimit, card.currency)} · {percent}%
          </p>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${percent}% of the spend limit used`}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              nearLimit
                ? "bg-orange-500 dark:bg-orange-500"
                : "bg-blue-500 dark:bg-blue-500",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>

        <p className="mt-2 text-sm text-gray-500">
          {card.status === "cancelled"
            ? "This card is cancelled. Nothing further can be authorized on it."
            : remaining > 0
              ? `${formatMoney(remaining, card.currency)} remaining.`
              : "The limit is exhausted."}
          {nearLimit && card.status !== "cancelled" && remaining > 0 && (
            <span className="ml-1 text-orange-600 dark:text-orange-500">
              Past 80% of the limit.
            </span>
          )}
        </p>
      </section>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
        </Field>
        <Field label="Status">
          <StatusBadge status={card.status} />
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
          <span className="ml-2 text-gray-500">{card.currency}</span>
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
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Card ID">
          <span className="font-mono text-sm">{card.id}</span>
        </Field>
      </dl>

      <Divider />

      <p className="text-sm text-gray-500">
        The full number was shown once, when this card was issued. It is not
        stored and cannot be shown again.
      </p>
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
