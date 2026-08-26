import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/** Past this share of the limit, the bar warns rather than reassures. */
const WARN_AT = 80

// Widths in twelfths. Tailwind only per components.md; one scannable string
// so the JIT still sees every literal class name.
const WIDTHS =
  "w-0 w-1/12 w-2/12 w-3/12 w-4/12 w-5/12 w-6/12 w-7/12 w-8/12 w-9/12 w-10/12 w-11/12 w-full".split(
    " ",
  )

/** Minor units in, formatted here at the edge and nowhere upstream. */
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
            WIDTHS[Math.min(12, Math.round((percent / 100) * 12))],
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
