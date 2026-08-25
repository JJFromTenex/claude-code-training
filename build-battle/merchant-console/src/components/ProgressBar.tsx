import { cx } from "@/lib/utils"
import { progressTone, spendRatio } from "@/lib/progress"

/**
 * Spend progress. Turns amber at 80% of the limit or higher.
 *
 * The fill's width is data-driven (spend / limit), so it's the one place
 * here that needs an inline style — there's no static Tailwind class for
 * an arbitrary computed percentage. The ratio/threshold math itself lives
 * in `@/lib/progress` so it's unit-tested, not just visually checked.
 */
export function ProgressBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const ratio = spendRatio(value, max)
  const fillColor = progressTone(ratio) === "amber" ? "bg-amber-500" : "bg-blue-500"

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cx(
        "h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800",
        className,
      )}
    >
      <div
        className={cx("h-full rounded-full transition-all", fillColor)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  )
}
