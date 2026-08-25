import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/** Past this share of the limit, the bar warns. */
const AMBER_THRESHOLD = 0.8

/**
 * Bar widths as static classes, in five-point steps.
 *
 * Tailwind only, no inline styles, so the width cannot be interpolated —
 * these have to be whole class names for the compiler to keep them.
 */
const WIDTHS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]",
  "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]",
  "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
] as const

function widthClass(percent: number): string {
  const step = Math.round(Math.min(100, Math.max(0, percent)) / 5)
  return WIDTHS[step]
}

/**
 * Spend against the limit.
 *
 * Takes minor units and formats here, at the edge. The percentage is derived
 * for display only and never feeds an amount.
 */
export function SpendProgress({
  spend,
  spendLimit,
  currency,
}: {
  spend: number
  spendLimit: number
  currency: Currency
}) {
  const ratio = spendLimit > 0 ? spend / spendLimit : 0
  const percent = Math.round(ratio * 100)
  const warning = ratio >= AMBER_THRESHOLD

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm text-gray-900 dark:text-gray-50">
          <span className="font-medium tabular-nums">
            {formatMoney(spend, currency)}
          </span>
          <span className="text-gray-500">
            {" "}
            of {formatMoney(spendLimit, currency)}
          </span>
        </p>
        <p
          className={cx(
            "text-sm font-medium tabular-nums",
            warning
              ? "text-amber-600 dark:text-amber-500"
              : "text-gray-500",
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
        aria-label={`Spend against limit: ${percent} percent`}
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            widthClass(percent),
            warning
              ? "bg-amber-500 dark:bg-amber-500"
              : "bg-blue-500 dark:bg-blue-500",
          )}
        />
      </div>

      {warning && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
          {percent >= 100
            ? "This card has reached its limit."
            : "This card is close to its limit."}
        </p>
      )}
    </div>
  )
}
