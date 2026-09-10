import { Currency } from "@/data/types"
import { isSpendWarning, spendRatio } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Twelfth-width classes as literal strings so Tailwind's scanner finds them.
 * A computed class name would be dropped from the build.
 */
const WIDTHS = [
  "w-0",
  "w-1/12",
  "w-2/12",
  "w-3/12",
  "w-4/12",
  "w-5/12",
  "w-6/12",
  "w-7/12",
  "w-8/12",
  "w-9/12",
  "w-10/12",
  "w-11/12",
  "w-full",
]

export function SpendProgress({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const ratio = spendRatio(spent, limit)
  const warning = isSpendWarning(spent, limit)
  const percent = Math.round(ratio * 100)
  const width = WIDTHS[Math.round(ratio * 12)]

  return (
    <div className="mt-4">
      <p className="text-sm tabular-nums text-gray-900 dark:text-gray-50">
        {formatMoney(spent, currency)} of {formatMoney(limit, currency)}
        <span
          className={cx(
            "ml-2",
            warning ? "text-amber-600 dark:text-amber-500" : "text-gray-500",
          )}
        >
          · {percent}%
        </span>
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={spent}
        aria-label="Spend against limit"
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-2 rounded-full",
            width,
            warning ? "bg-amber-500" : "bg-blue-500",
          )}
        />
      </div>
    </div>
  )
}
