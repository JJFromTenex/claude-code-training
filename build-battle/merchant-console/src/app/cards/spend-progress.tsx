import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/** Percent of the limit used. Inputs are integer minor units; the percent is display only. */
export function spendPercent(spent: number, limit: number): number {
  return limit <= 0 ? 0 : Math.min(100, Math.round((spent * 100) / limit))
}

// Tailwind only, no inline styles: 21 static width classes in 5% steps so the JIT can see them.
const WIDTHS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]",
  "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
] as const

/** Spend against limit: amber from 80% of the limit, red at or over it. */
export function SpendProgress({ spent, limit, currency }: { spent: number; limit: number; currency: Currency }) {
  const percent = spendPercent(spent, limit)
  const tone = percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-blue-500"

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)}
          <span className="ml-1 font-normal text-gray-500">of {formatMoney(limit, currency)}</span>
        </span>
        <span className={cx("tabular-nums", percent >= 80 ? "font-medium text-amber-700 dark:text-amber-400" : "text-gray-500")}>
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${formatMoney(spent, currency)} of ${formatMoney(limit, currency)} spent`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div className={cx("h-full rounded-full transition-all", tone, WIDTHS[Math.round(percent / 5)])} />
      </div>
      <p className="text-sm text-gray-500">{formatMoney(Math.max(0, limit - spent), currency)} remaining</p>
    </div>
  )
}
