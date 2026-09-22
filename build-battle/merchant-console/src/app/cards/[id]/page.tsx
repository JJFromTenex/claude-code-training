import { Divider } from "@/components/Divider"
import { SpendProgress } from "@/components/ui/cards/SpendProgress"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { CATEGORY_LABELS, cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskLast4 } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

/**
 * One card's full record.
 *
 * "Full record" is everything the console keeps, which does not include the
 * number: that was shown once at issue and only the last four and a reference
 * survive.
 */
export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              {card.nickname}
            </h1>
            <StatusBadge status={card.status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-500">
            {maskLast4(card.last4)} · {card.id}
          </p>
        </div>

        <CardActions
          cardId={card.id}
          status={card.status}
          nickname={card.nickname}
        />
      </div>

      {card.status === "cancelled" && (
        <p
          className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
          role="status"
        >
          This card is cancelled. Cancelling is final — issue a new card
          instead of trying to reinstate this one.
        </p>
      )}

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <div className="mt-4 max-w-md">
        <SpendProgress
          spend={card.spend}
          spendLimit={card.spendLimit}
          currency={card.currency}
        />
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant ? (
            <>
              {merchant.name}
              <span className="ml-2 text-gray-500">{merchant.country}</span>
            </>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Spend limit">
          <span className="tabular-nums">
            {formatMoney(card.spendLimit, card.currency)}
          </span>
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Spent">
          <span className="tabular-nums">
            {formatMoney(card.spend, card.currency)}
          </span>
        </Field>
        <Field label="Card number">
          <span className="font-mono">{maskLast4(card.last4)}</span>
        </Field>
        <Field label="Category lock">
          {card.categoryLock ? CATEGORY_LABELS[card.categoryLock] : "None"}
        </Field>
        <Field label="Reference">
          <span className="font-mono text-xs">{card.reference}</span>
        </Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        {merchant && (
          <Field label={`Created (${merchant.timezone})`}>
            {formatInZone(card.createdAt, merchant.timezone)}
          </Field>
        )}
        <Field label="Type">Virtual · single merchant</Field>
      </dl>
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
