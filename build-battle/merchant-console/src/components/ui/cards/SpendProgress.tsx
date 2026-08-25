import { cx } from "@/lib/utils"

export function SpendProgress({
  spent,
  limit,
}: {
  spent: number
  limit: number
}) {
  const percent = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-500">
          {percent}% used
        </span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend progress"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            percent >= 100
              ? "bg-red-500"
              : percent >= 80
                ? "bg-amber-500"
                : "bg-emerald-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}
