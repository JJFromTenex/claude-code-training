import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against the limit. Receives minor units and formats at the edge.
 * The amber threshold is compared in integers: past 80% means spent × 5
 * is more than limit × 4.
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
  const capped = Math.min(spent, limit)
  const amber = spent * 5 > limit * 4
  const percent = Math.floor((capped * 100) / limit)

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)} spent
        </span>
        <span className="tabular-nums text-gray-500">
          {formatMoney(limit, currency)} limit · {percent}%
        </span>
      </div>
      <progress
        value={capped}
        max={limit}
        aria-label={`Spend against limit, ${percent}%`}
        className={cx(
          "mt-2 h-2 w-full overflow-hidden rounded-full",
          "[&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-800",
          "bg-gray-200 dark:bg-gray-800",
          "[&::-moz-progress-bar]:rounded-full [&::-webkit-progress-value]:rounded-full",
          amber
            ? "[&::-moz-progress-bar]:bg-amber-500 [&::-webkit-progress-value]:bg-amber-500"
            : "[&::-moz-progress-bar]:bg-blue-500 [&::-webkit-progress-value]:bg-blue-500",
        )}
      />
      {amber && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
          {spent >= limit
            ? "Limit reached. New charges will decline."
            : "More than 80% of the limit is used."}
        </p>
      )}
    </div>
  )
}
