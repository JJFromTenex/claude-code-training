import { Currency } from "@/data/types"
import { SPEND_WARNING_PERCENT, spendPercent } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

/**
 * Spend against a card's limit. Twenty fixed-width segments rather than a
 * computed width, so the bar is Tailwind-only (no inline style) and still
 * reads as a progressbar to assistive tech. Turns amber past 80% and red at
 * or over the limit.
 */

const SEGMENTS = 20

export function SpendProgress({
  spent,
  limit,
  currency,
}: {
  spent: number
  limit: number
  currency: Currency
}) {
  const percent = spendPercent(spent, limit)
  const shown = Math.min(percent, 100)
  const filled = Math.ceil((shown / 100) * SEGMENTS)
  const tone =
    percent >= 100 ? "over" : percent > SPEND_WARNING_PERCENT ? "warning" : "ok"

  const fill = {
    ok: "bg-blue-500 dark:bg-blue-500",
    warning: "bg-amber-500 dark:bg-amber-500",
    over: "bg-red-500 dark:bg-red-500",
  }[tone]

  const note = {
    ok: null,
    warning: `Past ${SPEND_WARNING_PERCENT}% of its limit.`,
    over: "At or over its limit.",
  }[tone]

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
        <span className="tabular-nums text-gray-900 dark:text-gray-50">
          {formatMoney(spent, currency)}{" "}
          <span className="text-gray-500">of {formatMoney(limit, currency)}</span>
        </span>
        <span
          className={cx(
            "tabular-nums",
            tone === "ok"
              ? "text-gray-500"
              : tone === "warning"
                ? "font-medium text-amber-600 dark:text-amber-500"
                : "font-medium text-red-600 dark:text-red-500",
          )}
        >
          {percent}% used
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Spend against limit"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={shown}
        aria-valuetext={`${percent}% of the limit used`}
        className="mt-2 flex gap-0.5"
      >
        {Array.from({ length: SEGMENTS }, (_, index) => (
          <span
            key={index}
            aria-hidden="true"
            className={cx(
              "h-2 flex-1 rounded-sm",
              index < filled ? fill : "bg-gray-200 dark:bg-gray-800",
            )}
          />
        ))}
      </div>
      {note && (
        <p
          className={cx(
            "mt-1.5 text-sm",
            tone === "warning"
              ? "text-amber-600 dark:text-amber-500"
              : "text-red-600 dark:text-red-500",
          )}
        >
          {note}
        </p>
      )}
    </div>
  )
}
