import { formatMoney } from "@/lib/money"
import { Currency } from "@/data/types"
import { cx } from "@/lib/utils"

/**
 * Spend against a card's limit. No transaction data exists for cards in this
 * store, so every real caller passes spent: 0 — this component is still
 * built correct-by-construction (ratio fill, amber past 80%) rather than
 * left unbuilt.
 */
export function SpendProgress({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const ratio = limit > 0 ? Math.min(spent / limit, 1) : 0
  const amber = limit > 0 && spent / limit >= 0.8

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)}
        </span>
        <span className="text-gray-500">of {formatMoney(limit, currency)}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          role="progressbar"
          aria-valuenow={Math.round(ratio * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          className={cx(
            "h-full rounded-full transition-all",
            amber ? "bg-amber-500 dark:bg-amber-500" : "bg-blue-500 dark:bg-blue-500",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  )
}
