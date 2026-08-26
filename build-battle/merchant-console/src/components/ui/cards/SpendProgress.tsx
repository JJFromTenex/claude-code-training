import { cx } from "@/lib/utils"

/**
 * A percentage fill has no discrete Tailwind class to express it — same
 * exception Drawer.tsx already takes for animation timing. The bar itself
 * stays Tailwind; only the computed width is inline.
 */
export function SpendProgress({ spent, limit }: { spent: number; limit: number }) {
  const ratio = limit > 0 ? spent / limit : 0
  const percent = Math.min(100, Math.max(0, ratio * 100))
  const isHigh = ratio > 0.8

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
    >
      <div
        className={cx(
          "h-full rounded-full transition-all",
          isHigh ? "bg-amber-500" : "bg-blue-500",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
