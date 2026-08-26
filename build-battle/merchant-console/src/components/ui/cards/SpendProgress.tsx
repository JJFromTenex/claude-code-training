import { Currency } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"

// Tailwind's scanner needs each class written literally in source, so the
// width is snapped to the nearest 5% and looked up here rather than built
// as a dynamic string — that also keeps this Tailwind-only, no inline style.
const WIDTH_CLASSES = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]",
  "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]",
  "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]",
  "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]",
  "w-full",
] as const

function widthClassFor(percent: number): string {
  const index = Math.round(Math.min(100, Math.max(0, percent)) / 5)
  return WIDTH_CLASSES[index]
}

export function SpendProgress({
  spentMinorUnits,
  limitMinorUnits,
  currency,
}: {
  spentMinorUnits: number
  limitMinorUnits: number
  currency: Currency
}) {
  const ratio = limitMinorUnits > 0 ? spentMinorUnits / limitMinorUnits : 0
  const percent = Math.min(100, Math.round(ratio * 100))
  const nearLimit = ratio >= 0.8

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-gray-900 dark:text-gray-50">
          {formatMoney(spentMinorUnits, currency)} spent
        </span>
        <span className="text-gray-500">of {formatMoney(limitMinorUnits, currency)}</span>
      </div>
      <div
        className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Spend against limit"
      >
        <div
          className={cx(
            "h-full rounded-full transition-all",
            nearLimit ? "bg-amber-500" : "bg-blue-500",
            widthClassFor(percent),
          )}
        />
      </div>
    </div>
  )
}
