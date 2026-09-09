import { barWidthClass, spendPercent, SPEND_WARNING_PERCENT } from "@/lib/cards"
import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against the limit. Both figures arrive as integer minor units and are
 * formatted here, at the edge. Past 80% the bar goes amber.
 */
export function SpendBar({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const percent = spendPercent(spent, limit)
  const warning = percent > SPEND_WARNING_PERCENT

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <p className="tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)} of {formatMoney(limit, currency)}
        </p>
        <p
          className={cx(
            "tabular-nums",
            warning
              ? "font-medium text-amber-600 dark:text-amber-500"
              : "text-gray-500",
          )}
        >
          {percent}%
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend against the card limit"
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-full rounded-full",
            warning ? "bg-amber-500" : "bg-blue-500",
            barWidthClass(percent),
          )}
        />
      </div>
    </div>
  )
}
