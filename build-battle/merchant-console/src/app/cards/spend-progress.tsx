import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against limit. Amber once 80% of the limit is used, red at or over
 * it. Both inputs are integer minor units; the percentage is display only.
 */
export function spendPercent(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((spent * 100) / limit))
}

/**
 * Tailwind only, no inline styles: the bar width is one of 21 static classes
 * in 5% steps, which is plenty for a progress bar and lets the JIT see them.
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

function widthClass(percent: number): string {
  return WIDTHS[Math.min(WIDTHS.length - 1, Math.round(percent / 5))]
}

export function SpendProgress({
  spent,
  limit,
  currency,
  compact = false,
}: {
  spent: number
  limit: number
  currency: Currency
  compact?: boolean
}) {
  const percent = spendPercent(spent, limit)
  const tone =
    percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-blue-500"
  const label = `${formatMoney(spent, currency)} of ${formatMoney(limit, currency)} spent`

  return (
    <div className={cx("flex flex-col", compact ? "gap-1" : "gap-2")}>
      {!compact && (
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {formatMoney(spent, currency)}
            <span className="ml-1 font-normal text-gray-500">
              of {formatMoney(limit, currency)}
            </span>
          </span>
          <span
            className={cx(
              "tabular-nums",
              percent >= 80 ? "font-medium text-amber-700 dark:text-amber-400" : "text-gray-500",
            )}
          >
            {percent}%
          </span>
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className={cx(
          "w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
          compact ? "h-1.5" : "h-2.5",
        )}
      >
        <div className={cx("h-full rounded-full transition-all", tone, widthClass(percent))} />
      </div>
      {!compact && (
        <p className="text-sm text-gray-500">
          {formatMoney(Math.max(0, limit - spent), currency)} remaining
        </p>
      )}
    </div>
  )
}
