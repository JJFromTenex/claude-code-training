import { Currency } from "@/data/types"
import { isNearLimit, spendBarSteps } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against a card's limit.
 *
 * Both amounts arrive as minor units and are formatted here, at the edge. The
 * bar width is a static Tailwind class rather than an inline style, so it
 * snaps to five-percent steps; a bar is read, not measured.
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

export function SpendProgress({
  spent,
  limit,
  currency,
}: {
  /** Integer minor units. */
  spent: number
  /** Integer minor units. */
  limit: number
  currency: Currency
}) {
  // Both comparisons live in src/lib/cards.ts, where they are unit-tested:
  // spend never reaches eighty percent in this app yet, so the threshold has
  // no other way to be proven.
  const nearLimit = isNearLimit(spent, limit)
  const steps = spendBarSteps(spent, limit)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)}
        </span>
        <span className="text-sm tabular-nums text-gray-500">
          of {formatMoney(limit, currency)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Spend against limit"
        aria-valuenow={spent}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuetext={`${formatMoney(spent, currency)} of ${formatMoney(limit, currency)}`}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-full rounded-full",
            WIDTHS[steps],
            nearLimit
              ? "bg-amber-500 dark:bg-amber-500"
              : "bg-blue-500 dark:bg-blue-500",
          )}
        />
      </div>
    </div>
  )
}
