import { formatMoney } from "@/lib/money"
import { Currency } from "@/data/types"
import { cx } from "@/lib/utils"

/** Spend against the limit. Turns amber past 80%, the way a limit that matters should. */
export function SpendBar({
  spend,
  limit,
  currency,
}: {
  spend: number
  limit: number
  currency: Currency
}) {
  const pct = limit > 0 ? Math.min(100, (spend / limit) * 100) : 0
  const amber = pct >= 80

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spend, currency)}
        </span>
        <span className="text-gray-500">of {formatMoney(limit, currency)}</span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend against limit"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            amber ? "bg-amber-500 dark:bg-amber-500" : "bg-blue-500 dark:bg-blue-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-xs text-gray-500">{pct.toFixed(0)}% of limit</p>
    </div>
  )
}
