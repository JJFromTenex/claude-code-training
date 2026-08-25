// Checkbox

import * as React from "react"
import { RiCheckLine } from "@remixicon/react"

import { cx, focusRing } from "@/lib/utils"

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, onCheckedChange, ...props }, forwardedRef) => {
    return (
      <span className="relative inline-flex size-4 shrink-0 items-center justify-center">
        <input
          ref={forwardedRef}
          type="checkbox"
          onChange={(event) => onCheckedChange?.(event.target.checked)}
          className={cx(
            // base
            "peer size-4 shrink-0 cursor-pointer appearance-none rounded border transition-colors",
            // border and background
            "border-gray-300 bg-white dark:border-gray-700 dark:bg-gray-950",
            // checked
            "checked:border-blue-500 checked:bg-blue-500 dark:checked:border-blue-500 dark:checked:bg-blue-500",
            // disabled
            "disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 dark:disabled:border-gray-800 dark:disabled:bg-gray-800",
            focusRing,
            className,
          )}
          {...props}
        />
        <RiCheckLine
          aria-hidden="true"
          className="pointer-events-none absolute size-3 text-white opacity-0 peer-checked:opacity-100 peer-disabled:opacity-0"
        />
      </span>
    )
  },
)
Checkbox.displayName = "Checkbox"

export { Checkbox, type CheckboxProps }
