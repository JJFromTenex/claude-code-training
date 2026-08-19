import { getCard, merchantNameFor } from "@/data/cards"
import { CardCategory } from "@/data/types"
import { maskNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"
import { CardStatusBadge } from "../card-status-badge"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  subscriptions: "Vendor subscriptions",
  advertising: "Ad spend",
  contractors: "Contractor tools",
  travel: "Travel",
  general: "General",
}

/** Spend bar turns amber past this share of the limit. */
const AMBER_AT = 0.8

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = getCard(id)
  if (!card) notFound()

  const share = card.limit > 0 ? card.spent / card.limit : 0
  const pct = Math.min(100, Math.round(share * 100))
  const amber = share >= AMBER_AT

  const rows: [string, React.ReactNode][] = [
    ["Merchant", merchantNameFor(card)],
    ["Number", <span key="n" className="font-mono tabular-nums">{maskNumber(card.last4)}</span>],
    ["Status", <CardStatusBadge key="s" status={card.status} />],
    ["Category lock", CATEGORY_LABELS[card.category]],
    ["Currency", card.currency],
    ["Created", formatDate(card.createdAt)],
    ["Reference", <span key="r" className="font-mono text-xs text-gray-500">{card.numberRef}</span>],
  ]

  return (
    <section aria-label={`Card ${card.nickname}`} className="p-4 sm:p-6">
      <Link href="/cards" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50">
        ← All cards
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-gray-900 dark:text-gray-50">{card.nickname}</h1>

      <div className="mt-6 rounded-md border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">Spend against limit</p>
          <p className="text-sm tabular-nums text-gray-500">
            {formatMoney(card.spent, card.currency)} of {formatMoney(card.limit, card.currency)}
            <span className="ml-2 text-gray-400">({pct}%)</span>
          </p>
        </div>
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Spend against limit"
        >
          <div
            className={cx("h-full rounded-full", amber ? "bg-amber-500" : "bg-emerald-600 dark:bg-emerald-500")}
            style={{ width: `${pct}%` }}
          />
        </div>
        {amber ? (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Past {Math.round(AMBER_AT * 100)}% of the limit.
          </p>
        ) : null}
      </div>

      <dl className="mt-6 divide-y divide-gray-200 rounded-md border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-3 gap-4 px-4 py-3 text-sm">
            <dt className="text-gray-500">{label}</dt>
            <dd className="col-span-2 text-gray-900 dark:text-gray-50">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
