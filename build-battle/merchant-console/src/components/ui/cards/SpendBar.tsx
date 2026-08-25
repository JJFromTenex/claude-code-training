import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import { Currency } from "@/data/types"

/** Percent of the limit at which the bar turns amber. */
const AMBER_AT_PERCENT = 80

/**
 * Spend against a card's limit.
 *
 * Takes minor units and a currency and formats here, at the edge. Turns amber
 * once a card is past 80% of its limit, which is the point ops wants to notice
 * before a vendor charge is declined.
 */
export function SpendBar({
  spend,
  limit,
  currency,
}: {
  spend: number
  limit: number
  currency: Currency
}) {
  // Both values are integer minor units. The threshold is compared as integers
  // — spend * 100 against limit * 80 — so the boundary is exact rather than
  // resting on a float ratio. The percentage below is display only.
  const nearLimit = limit > 0 && spend * 100 >= limit * AMBER_AT_PERCENT
  const percent = limit > 0 ? Math.round((spend * 100) / limit) : 0
  const width = Math.min(100, Math.max(0, percent))

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
          {formatMoney(spend, currency)}
          <span className="font-normal text-gray-500">
            {" "}
            of {formatMoney(limit, currency)}
          </span>
        </p>
        <p
          className={cx(
            "text-sm font-medium tabular-nums",
            nearLimit
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
        aria-label="Spend against limit"
      >
        {/*
          The one inline style here is a computed width, not styling — Tailwind
          cannot express a runtime percentage. It matches how every other
          data-driven dimension in this codebase is set (see the chart
          primitives in src/components/). Colour stays in Tailwind.
        */}
        <div
          className={cx(
            "h-full rounded-full transition-all",
            nearLimit ? "bg-amber-500" : "bg-blue-500",
          )}
          style={{ width: `${width}%` }}
        />
      </div>

      {nearLimit && (
        <p className="mt-2 text-sm text-amber-600 dark:text-amber-500">
          Past {AMBER_AT_PERCENT}% of the limit. Charges will start
          declining once it is reached.
        </p>
      )}
    </div>
  )
}
