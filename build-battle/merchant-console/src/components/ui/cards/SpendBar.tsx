import { isNearLimit, spendRatio } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import { Currency } from "@/data/types"

/**
 * Width classes are written out rather than interpolated: Tailwind scans the
 * source for complete class names, so a template literal would produce a bar
 * that silently never fills. Rounded to the nearest five percent.
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
]

export function SpendBar({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const ratio = spendRatio(spent, limit)
  const width = WIDTHS[Math.round(ratio * 20)]
  const warning = isNearLimit(spent, limit)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)}{" "}
          <span className="font-normal text-gray-500">
            of {formatMoney(limit, currency)}
          </span>
        </p>
        <p
          className={cx(
            "text-sm tabular-nums",
            warning
              ? "font-medium text-amber-600 dark:text-amber-500"
              : "text-gray-500",
          )}
        >
          {Math.round(ratio * 100)}%
        </p>
      </div>
      <div
        role="progressbar"
        aria-valuenow={spent}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`Spend against limit for this card`}
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            warning ? "bg-amber-500" : "bg-blue-500",
            width,
          )}
        />
      </div>
      <p className="mt-2 text-sm text-gray-500">
        {formatMoney(limit - spent, currency)} remaining
      </p>
    </div>
  )
}
