// Tremor Checkbox [v0.0.1]

import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "type"> {}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, ...props }, forwardedRef) => {
    return (
      <input
        ref={forwardedRef}
        type="checkbox"
        tremor-id="tremor-raw"
        className={cx(
          // base
          "size-4 shrink-0 cursor-pointer appearance-none rounded border shadow-sm outline-none transition",
          // accent (native check mark / fill color)
          "accent-blue-500 dark:accent-blue-500",
          // border color
          "border-gray-300 dark:border-gray-800",
          // background color
          "bg-white dark:bg-gray-950",
          // checked
          "checked:border-blue-500 checked:bg-blue-500 dark:checked:border-blue-500 dark:checked:bg-blue-500",
          // disabled
          "disabled:cursor-not-allowed disabled:border-gray-300 disabled:bg-gray-100 disabled:text-gray-400",
          "disabled:dark:border-gray-700 disabled:dark:bg-gray-800 disabled:dark:text-gray-500",
          // focus
          focusRing,
          className,
        )}
        {...props}
      />
    )
  },
)

Checkbox.displayName = "Checkbox"

export { Checkbox, type CheckboxProps }
