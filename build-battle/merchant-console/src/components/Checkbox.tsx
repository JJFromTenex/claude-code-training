// Northwind Checkbox — native input, Tremor-styled.

import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

interface CheckboxProps extends Omit<
  React.ComponentPropsWithoutRef<"input">,
  "type"
> {
  /** Rendered beside the box and wired to it, so the label is always clickable. */
  label: React.ReactNode
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, forwardedRef) => {
    const generatedId = React.useId()
    const inputId = id ?? generatedId

    return (
      <div className={cx("flex items-center gap-2", className)}>
        <input
          ref={forwardedRef}
          id={inputId}
          type="checkbox"
          className={cx(
            "size-4 shrink-0 rounded border-gray-300 text-blue-500 accent-blue-500",
            "dark:border-gray-700 dark:bg-gray-900",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing,
          )}
          {...props}
        />
        <label
          htmlFor={inputId}
          className="select-none text-sm text-gray-900 dark:text-gray-50"
        >
          {label}
        </label>
      </div>
    )
  },
)

Checkbox.displayName = "Checkbox"

export { Checkbox, type CheckboxProps }
