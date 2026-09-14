import { Divider } from "@/components/Divider"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { cardById } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardActions } from "../card-actions"
import { SpendProgress } from "../spend-progress"

export const dynamic = "force-dynamic"

export default async function CardDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()
  const merchant = merchantById(card.merchantId)!

  return (
    <div className="p-4 sm:p-6">
      <Link href="/cards" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50">← All cards</Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">{card.nickname}</h1>
        <StatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">{maskCardNumber(card.last4)} · {card.id}</p>
      <div className="mt-4"><CardActions card={card} /></div>

      <Divider />
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Spend</h2>
      <div className="mt-3 max-w-xl"><SpendProgress spent={card.spent} limit={card.spendLimit} currency={card.currency} /></div>

      <Divider />
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">{merchant.name}<span className="ml-2 text-gray-500">{merchant.country}</span></Field>
        <Field label="Spend limit">
          <span className="tabular-nums">{formatMoney(card.spendLimit, card.currency)}</span>
          <span className="ml-2 text-gray-500">{card.currency}</span>
        </Field>
        <Field label="Category lock">{CARD_CATEGORY_LABELS[card.category]}</Field>
        <Field label="Card number">
          <span className="font-mono">{maskCardNumber(card.last4)}</span>
          <span className="ml-2 text-gray-500">shown in full only at issue</span>
        </Field>
        <Field label="Number reference"><span className="font-mono">{card.numberRef}</span></Field>
        <Field label="Created (UTC)"><span className="font-mono">{card.createdAt}</span></Field>
        <Field label={`Created (${merchant.timezone})`}>{formatInZone(card.createdAt, merchant.timezone)}</Field>
      </dl>

      <Divider />
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">History</h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500" aria-hidden="true" />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">{index === 0 ? "Issued" : `Marked ${entry.status}`}</p>
              <p className="text-sm text-gray-500">{formatInZone(entry.at, merchant.timezone)}</p>
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
