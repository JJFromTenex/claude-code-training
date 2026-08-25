import { spendRatio } from "@/data/card-catalog"
import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against a card's limit. Receives minor units and a currency and
 * formats here, at the edge. Amber past 80%, red at the limit, so a card
 * about to decline is visible before it does.
 */

const AMBER = 0.8

/**
 * Fixed 5% steps. Tailwind cannot compile a runtime value and `components.md`
 * forbids an inline style, so the bar quantises. Written as one string because
 * Tailwind scans source text for class names; the exact figure is in the label
 * and in `aria-valuenow`.
 */
const WIDTHS = (
  "w-0 w-[5%] w-[10%] w-[15%] w-[20%] w-[25%] w-[30%] w-[35%] w-[40%] w-[45%] " +
  "w-[50%] w-[55%] w-[60%] w-[65%] w-[70%] w-[75%] w-[80%] w-[85%] w-[90%] w-[95%] w-full"
).split(" ")

export function SpendProgress({
  spent,
  spendLimit,
  currency,
}: {
  spent: number
  spendLimit: number
  currency: Currency
}) {
  const ratio = spendRatio(spent, spendLimit)
  const percent = Math.round(ratio * 100)
  const remaining = spendLimit - spent

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)}
          <span className="font-normal text-gray-500">
            {" "}
            of {formatMoney(spendLimit, currency)}
          </span>
        </p>
        <p
          className={cx(
            "text-sm font-medium tabular-nums",
            ratio > AMBER ? "text-amber-700 dark:text-amber-500" : "text-gray-500",
          )}
        >
          {percent}%
        </p>
      </div>

      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Spend against limit"
      >
        <div
          className={cx(
            "h-full rounded-full",
            ratio >= 1
              ? "bg-red-500"
              : ratio > AMBER
                ? "bg-amber-500"
                : "bg-blue-500",
            WIDTHS[Math.round(ratio * 20)],
          )}
        />
      </div>

      <p className="mt-2 text-sm text-gray-500">
        {spent === 0
          ? "Nothing has been authorised on this card yet."
          : remaining > 0
            ? `${formatMoney(remaining, currency)} left before this card declines.`
            : "This card has reached its limit and will decline."}
      </p>
    </div>
  )
}
