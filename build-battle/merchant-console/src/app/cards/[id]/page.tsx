import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById } from "@/data/queries"
import { maskLast4, spendFraction } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

/** The first entry is always the issuance; later `active` entries are unfreezes. */
function historyLabel(status: string, index: number): string {
  if (index === 0) return "Issued"
  if (status === "active") return "Unfrozen"
  if (status === "frozen") return "Frozen"
  return "Cancelled"
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
  const fraction = spendFraction(card)
  const amber = fraction > 0.8

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <StatusBadge status={card.status} />
        </div>
        <CardActions cardId={card.id} status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{maskLast4(card.last4)}</p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Category">{CATEGORY_LABELS[card.category] ?? card.category}</Field>
        <Field label="Spend limit">{formatMoney(card.spendLimit, card.currency)}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.reference}</span>
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend
      </h2>
      <div className="mt-4 max-w-md">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-gray-900 dark:text-gray-50">
            {formatMoney(card.spent, card.currency)}
          </span>
          <span className="text-gray-500">
            of {formatMoney(card.spendLimit, card.currency)}
          </span>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
          role="progressbar"
          aria-valuenow={Math.round(fraction * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuetext={`${Math.round(fraction * 100)}% of the spend limit used`}
        >
          <div
            className={cx(
              "h-full rounded-full transition-all",
              amber ? "bg-amber-500" : "bg-blue-500",
            )}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        {amber && (
          <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
            Over 80% of the spend limit used.
          </p>
        )}
      </div>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        History
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {historyLabel(entry.status, index)}
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
