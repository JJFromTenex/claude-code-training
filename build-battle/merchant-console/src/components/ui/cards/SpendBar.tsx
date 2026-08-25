import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against the limit. Amber past 80%, because that is the point at which
 * ops wants to know before the merchant does.
 *
 * Receives minor units and formats here, which is where formatting belongs.
 */

/**
 * Widths as literal classes rather than an inline style: Tailwind only, per
 * `.claude/rules/components.md`, and a class built by interpolation would not
 * survive the JIT compiler anyway. The bar rounds to the nearest 5% while the
 * figure beside it stays exact.
 */
const WIDTHS: Record<number, string> = {
  0: "w-0",
  5: "w-[5%]",
  10: "w-[10%]",
  15: "w-[15%]",
  20: "w-[20%]",
  25: "w-[25%]",
  30: "w-[30%]",
  35: "w-[35%]",
  40: "w-[40%]",
  45: "w-[45%]",
  50: "w-[50%]",
  55: "w-[55%]",
  60: "w-[60%]",
  65: "w-[65%]",
  70: "w-[70%]",
  75: "w-[75%]",
  80: "w-[80%]",
  85: "w-[85%]",
  90: "w-[90%]",
  95: "w-[95%]",
  100: "w-full",
}

export function SpendBar({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const ratio = limit > 0 ? spent / limit : 0
  const percent = Math.min(100, Math.round(ratio * 100))
  const amber = ratio >= 0.8
  const width = WIDTHS[Math.round(percent / 5) * 5] ?? "w-0"

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)}{" "}
          <span className="text-gray-500">
            of {formatMoney(limit, currency)}
          </span>
        </span>
        <span
          className={cx(
            "text-sm font-medium tabular-nums",
            amber
              ? "text-amber-600 dark:text-amber-500"
              : "text-gray-500 dark:text-gray-400",
          )}
        >
          {percent}%
        </span>
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
            amber ? "bg-amber-500" : "bg-blue-500",
          )}
        />
      </div>
    </div>
  )
}
