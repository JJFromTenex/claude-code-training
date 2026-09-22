import { Currency } from "@/data/types"
import { SPEND_WARNING_PERCENT, spendPercent } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against a card's limit.
 *
 * Both amounts arrive as integer minor units with their currency and are
 * formatted here, at the edge. The bar turns amber once a card is within
 * reach of its limit, which is the thing ops wants to notice without reading
 * the numbers.
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
  const percent = spendPercent(spend, spendLimit)
  const warning = percent >= SPEND_WARNING_PERCENT
  const remaining = Math.max(0, spendLimit - spend)

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spend, currency)}
          <span className="font-normal text-gray-500">
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
            warning
              ? "bg-amber-500 dark:bg-amber-500"
              : "bg-blue-500 dark:bg-blue-500",
            // Tailwind-only: a fixed step per 5% rather than an inline style.
            WIDTHS[Math.min(20, Math.round(percent / 5))],
          )}
        />
      </div>

      <p className="mt-2 text-sm text-gray-500">
        {warning
          ? `${formatMoney(remaining, currency)} left before this card stops working.`
          : `${formatMoney(remaining, currency)} remaining.`}
      </p>
    </div>
  )
}

/**
 * Widths in 5% steps.
 *
 * `.claude/rules/components.md` forbids inline styles, and Tailwind cannot
 * build a class from a runtime value, so the steps are enumerated and the
 * percentage picks one.
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
