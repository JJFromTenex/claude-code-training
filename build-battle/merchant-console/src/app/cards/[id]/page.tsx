import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { SpendProgress } from "@/components/ui/cards/SpendProgress"
import { cardSpend } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = store.cards.find((c) => c.id === id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)
  const spent = cardSpend(card)

  return (
    <section aria-label="Card detail" className="px-4 py-6 sm:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/cards"
            className="text-sm text-blue-600 hover:underline dark:text-blue-500"
          >
            &larr; All cards
          </Link>
          <h1 className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-50">
            {card.nickname}
          </h1>
        </div>
        <CardActions cardId={card.id} status={card.status} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm text-gray-500">Card number</dt>
            <dd className="font-mono text-gray-900 dark:text-gray-50">
              {maskCardNumber(card.last4)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Merchant</dt>
            <dd className="text-gray-900 dark:text-gray-50">
              {merchant?.name ?? card.merchantId}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Status</dt>
            <dd>
              <CardStatusBadge status={card.status} />
            </dd>
          </div>
          {card.category && (
            <div>
              <dt className="text-sm text-gray-500">Category</dt>
              <dd className="capitalize text-gray-900 dark:text-gray-50">
                {card.category}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-gray-500">Created</dt>
            <dd className="text-gray-900 dark:text-gray-50">
              {formatDate(card.createdAt)}
            </dd>
          </div>
        </dl>

        <div className="space-y-6">
          <div>
            <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Spend
            </h2>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
              {formatMoney(spent, card.currency)}{" "}
              <span className="text-base font-normal text-gray-500">
                of {formatMoney(card.spendLimit, card.currency)}
              </span>
            </p>
            <div className="mt-3">
              <SpendProgress spent={spent} limit={card.spendLimit} />
            </div>
          </div>

          {card.history.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Status history
              </h2>
              <ul className="mt-2 space-y-1">
                {card.history.map((entry, i) => (
                  <li
                    key={i}
                    className="text-sm text-gray-500"
                  >
                    <span className="capitalize">{entry.from}</span>
                    {" → "}
                    <span className="capitalize">{entry.to}</span>
                    {" · "}
                    {formatDate(entry.at)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
