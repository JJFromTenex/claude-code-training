import { Currency } from "@/data/types"
import { isNearLimit, spendPercentage } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Pure, client-safe. Renders spend against limit with a track/fill bar.
 * Amber at or above 80% (isNearLimit), blue below.
 *
 * The fill is rendered as fixed-width segments (rather than a percentage
 * width) so every class stays a static Tailwind literal - no inline style,
 * no dynamically-interpolated arbitrary-value class.
 */
const SEGMENT_COUNT = 20

export function SpendProgressBar({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const percentage = spendPercentage(spent, limit)
  const nearLimit = isNearLimit(spent, limit)
  const filledSegments = Math.round((percentage / 100) * SEGMENT_COUNT)

  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)} of {formatMoney(limit, currency)}
        </span>
        <span className="text-gray-500">{percentage}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend against limit"
        className="mt-2 flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        {Array.from({ length: SEGMENT_COUNT }).map((_, index) => (
          <div
            key={index}
            className={cx(
              "h-full flex-1 rounded-full",
              index < filledSegments
                ? nearLimit
                  ? "bg-amber-500"
                  : "bg-blue-500"
                : "bg-transparent",
            )}
          />
        ))}
      </div>
    </div>
  )
}
