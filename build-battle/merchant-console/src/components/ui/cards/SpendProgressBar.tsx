import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/** Spend at or above this share of the limit reads as amber. */
const AMBER_AT = 80

/**
 * Widths are literal Tailwind classes because the rule is Tailwind only, no
 * inline styles, and Tailwind cannot generate a class from a value computed at
 * runtime. Rounding to the nearest five percent is a bar-width decision; the
 * exact figures are printed above it.
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

export function SpendProgressBar({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0
  const amber = percent >= AMBER_AT
  const width = WIDTHS[Math.round(percent / 5)]

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm tabular-nums text-gray-900 dark:text-gray-50">
          <span className="font-medium">{formatMoney(spent, currency)}</span>
          <span className="text-gray-500"> of {formatMoney(limit, currency)}</span>
        </p>
        <p
          className={cx(
            "text-sm font-medium tabular-nums",
            amber
              ? "text-amber-600 dark:text-amber-500"
              : "text-gray-500 dark:text-gray-500",
          )}
        >
          {percent}%
        </p>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend against limit"
      >
        <div
          className={cx(
            "h-full rounded-full",
            width,
            amber
              ? "bg-amber-500 dark:bg-amber-500"
              : "bg-blue-500 dark:bg-blue-500",
          )}
        />
      </div>

      {amber && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
          Past {AMBER_AT}% of the limit. Remaining:{" "}
          {formatMoney(Math.max(0, limit - spent), currency)}.
        </p>
      )}
    </div>
  )
}
