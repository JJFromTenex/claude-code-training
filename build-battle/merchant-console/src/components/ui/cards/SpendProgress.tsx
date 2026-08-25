import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/** Past this share of the limit, the bar warns rather than reassures. */
const WARN_AT = 80

/**
 * Spend against a limit. Both amounts arrive as minor units in the same
 * currency and are formatted here, at the edge, and nowhere upstream.
 */
export function SpendProgress({
  spend,
  spendLimit,
  currency,
  percent,
}: {
  spend: number
  spendLimit: number
  currency: Currency
  percent: number
}) {
  const warning = percent >= WARN_AT

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm tabular-nums text-gray-900 dark:text-gray-50">
          <span className="font-medium">{formatMoney(spend, currency)}</span>
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
              : "text-gray-500 dark:text-gray-400",
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
        aria-label={`Spend against limit: ${formatMoney(spend, currency)} of ${formatMoney(spendLimit, currency)}`}
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            warning ? "bg-amber-500" : "bg-blue-500",
            PERCENT_WIDTH[Math.min(20, Math.round(percent / 5))],
          )}
        />
      </div>
      {warning && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
          Past {WARN_AT}% of the limit. Spend above it will be declined.
        </p>
      )}
    </div>
  )
}

/**
 * Widths in 5% steps. Tailwind only, per the components rule — an inline
 * `style` would be the easy way and it is the one the repo does not allow.
 */
const PERCENT_WIDTH = [
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
