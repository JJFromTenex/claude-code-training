import { spendRatio } from "@/data/cards"
import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against a card's limit.
 *
 * Receives minor units and a currency and formats here, at the edge. The bar
 * turns amber once the card is past 80% of its limit and red once it is at
 * the limit, so a card about to decline is visible before it does.
 */

const AMBER_THRESHOLD = 0.8

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

  const barColor =
    ratio >= 1
      ? "bg-red-500 dark:bg-red-500"
      : ratio > AMBER_THRESHOLD
        ? "bg-amber-500 dark:bg-amber-500"
        : "bg-blue-500 dark:bg-blue-500"

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
            ratio > AMBER_THRESHOLD
              ? "text-amber-700 dark:text-amber-500"
              : "text-gray-500",
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
        aria-label={`Spend against limit: ${percent} percent`}
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            barColor,
            // Tailwind only, so the width comes from a fixed step class rather
            // than an inline style.
            WIDTH_STEPS[Math.min(20, Math.round(ratio * 20))],
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

/**
 * Fixed 5% steps. Tailwind cannot compile an arbitrary runtime value and the
 * components rule forbids an inline style, so the bar quantises instead.
 */
const WIDTH_STEPS = [
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
