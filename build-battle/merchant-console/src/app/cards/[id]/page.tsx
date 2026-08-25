import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { SpendBar } from "@/components/ui/cards/SpendBar"
import { cardById, paymentsForCard, spendForCard } from "@/data/card-queries"
import { SPEND_STATUSES } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { merchantById } from "@/data/merchants"
import { maskLast4 } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

const STATUS_LABELS: Record<CardStatus, string> = {
  active: "Active",
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

  const merchant = merchantById(card.merchantId)!
  const spend = spendForCard(card.id)
  const payments = paymentsForCard(card.id)

  return (
    <div className="p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← Cards
      </Link>

      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500">
            <span className="tabular-nums">{maskLast4(card.last4)}</span>
            <span aria-hidden="true">·</span>
            <span>{merchant.name}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={card.status} />
          <CardActions cardId={card.id} status={card.status} />
        </div>
      </div>

      <Divider />

      <div className="max-w-xl">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
          Spend against limit
        </h2>
        <div className="mt-3">
          <SpendBar
            spend={spend}
            limit={card.spendLimit}
            currency={card.currency}
          />
        </div>
        <p className="mt-3 text-sm text-gray-500">
          Summed from the {SPEND_STATUSES.join(", ")} payments on this card.
          Refunded and failed payments do not consume the limit.
        </p>
      </div>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Card ID" value={card.id} />
        <Field label="Number" value={maskLast4(card.last4)} />
        <Field label="Number reference" value={card.numberRef} />
        <Field label="Merchant" value={`${merchant.name} (${merchant.id})`} />
        <Field
          label="Spend limit"
          value={formatMoney(card.spendLimit, card.currency)}
        />
        <Field label="Currency" value={card.currency} />
        <Field label="Status" value={STATUS_LABELS[card.status]} />
        <Field
          label="Issued"
          value={formatInZone(card.createdAt, merchant.timezone)}
        />
        <Field label="Type" value="Virtual" />
      </dl>

      <Divider />

      <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
        Payments on this card
      </h2>
      {payments.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">
          Nothing has run on this card yet. It will show up here the first time
          the merchant is charged.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {payments.slice(0, 10).map((payment) => (
            <li
              key={payment.id}
              className="flex items-center justify-between gap-4 text-sm"
            >
              <Link
                href={`/payments/${payment.id}`}
                className="text-blue-600 hover:underline dark:text-blue-500"
              >
                {payment.id}
              </Link>
              <span className="text-gray-500">{payment.status}</span>
              <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
                {formatMoney(payment.amount, payment.currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Values render exactly as stored. Identifiers like `card_0002` and `mch_04`
 * are not prose and must not be title-cased on the way to the screen.
 */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-50">
        {value}
      </dd>
    </div>
  )
}
