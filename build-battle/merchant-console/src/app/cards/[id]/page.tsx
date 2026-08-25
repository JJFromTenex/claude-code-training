import { Divider } from "@/components/Divider"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { merchantById } from "@/data/merchants"
import { cardById } from "@/data/queries"
import { maskCard } from "@/lib/cards"
import { formatInZone } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { notFound } from "next/navigation"

const CATEGORY_LABELS: Record<string, string> = {
  ads: "Advertising",
  saas: "Software & SaaS",
  travel: "Travel",
  office: "Office & supplies",
  other: "Other",
}

/**
 * Tailwind needs literal class names, so the spend bar width snaps to 5%
 * steps from this list. The exact figures ride on the aria attributes and
 * the label; the amounts themselves stay integer minor units.
 */
const WIDTHS = [
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

export default async function CardDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const card = cardById(id)
  if (!card) notFound()

  const merchant = merchantById(card.merchantId)!

  // Display-only ratio for the progress bar; stored amounts remain integers.
  const ratio = card.spendLimit > 0 ? card.spent / card.spendLimit : 0
  const percent = Math.min(100, Math.round(ratio * 100))
  const width = WIDTHS[Math.min(20, Math.round(percent / 5))]
  const amber = ratio > 0.8

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
        <CardStatusBadge status={card.status} />
      </div>
      <p className="mt-1 font-mono text-sm text-gray-500">
        {maskCard(card.last4)} · {card.id}
      </p>

      <Divider />

      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Merchant">
          {merchant.name}
          <span className="ml-2 text-gray-500">{merchant.country}</span>
        </Field>
        <Field label="Number">
          <span className="font-mono">{maskCard(card.last4)}</span>
        </Field>
        <Field label="Reference">
          <span className="font-mono text-sm">{card.numberReference}</span>
        </Field>
        <Field label="Spend limit">
          {formatMoney(card.spendLimit, card.currency)}
        </Field>
        <Field label="Category lock">
          {card.categoryLock ? CATEGORY_LABELS[card.categoryLock] : "None"}
        </Field>
        <Field label="Currency">{card.currency}</Field>
        <Field label="Created (UTC)">
          <span className="font-mono text-sm">{card.createdAt}</span>
        </Field>
        <Field label={`Created (${merchant.timezone})`}>
          {formatInZone(card.createdAt, merchant.timezone)}
        </Field>
      </dl>

      <Divider />

      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
        Spend against limit
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        {formatMoney(card.spent, card.currency)} of{" "}
        {formatMoney(card.spendLimit, card.currency)} · {percent}%
      </p>
      <div
        role="progressbar"
        aria-label="Spend against limit"
        aria-valuemin={0}
        aria-valuemax={card.spendLimit}
        aria-valuenow={card.spent}
        className="mt-2 h-2 w-full max-w-md rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-2 rounded-full",
            width,
            // Amber past 80% of the limit, per the ticket.
            amber ? "bg-amber-500" : "bg-blue-500",
          )}
        />
      </div>
      {amber && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
          Past 80% of the spend limit.
        </p>
      )}
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
