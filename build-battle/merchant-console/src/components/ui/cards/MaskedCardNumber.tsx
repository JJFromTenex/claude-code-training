import { maskCardNumber } from "@/lib/cardNumber"
import { cx } from "@/lib/utils"

/**
 * The masked form is everything the console shows after creation. The full
 * number appears once, on the success screen, and is never stored.
 */
export function MaskedCardNumber({
  last4,
  className,
}: {
  last4: string
  className?: string
}) {
  return (
    <span
      className={cx("font-mono tabular-nums", className)}
      aria-label={`Card ending ${last4}`}
    >
      {maskCardNumber(last4)}
    </span>
  )
}
