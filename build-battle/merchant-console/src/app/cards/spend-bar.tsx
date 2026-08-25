import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against the limit. Both values are minor units and stay that way;
 * the percentage is integer arithmetic and the strings are formatted here,
 * at the edge, next to their currency.
 *
 * The width comes from a literal class map rather than an inline style: this
 * codebase is Tailwind-only, and Tailwind can only see class names that exist
 * as literal strings at build time. Rounding to 5% is invisible on a bar this
 * size and the exact figure is printed next to it.
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
  spend,
  limit,
  currency,
}: {
  spend: number
  limit: number
  currency: Currency
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((spend * 100) / limit)) : 0
  const nearLimit = percent >= 80

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spend, currency)}
          <span className="font-normal text-gray-500">
            {" "}
            of {formatMoney(limit, currency)}
          </span>
        </p>
        <p
          className={cx(
            "text-sm font-medium tabular-nums",
            nearLimit
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
        aria-label={`Spend against limit, ${percent} percent used`}
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            WIDTHS[Math.round(percent / 5) * 5],
            nearLimit
              ? "bg-amber-500 dark:bg-amber-500"
              : "bg-blue-500 dark:bg-blue-500",
          )}
        />
      </div>
      {nearLimit && (
        <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-500">
          Past 80% of the limit.
        </p>
      )}
    </div>
  )
}
