"use client"

import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

/**
 * A native checkbox with its label wrapped around it, so the association
 * needs no id and cannot break when the control is rendered in a loop.
 *
 * Styled with accent-* rather than border/rounded classes: this project does
 * not install @tailwindcss/forms (tailwind.config.ts has an empty plugins
 * array), so those classes would render in the diff and do nothing on screen.
 */

interface CheckboxProps
  extends Omit<React.ComponentPropsWithoutRef<"input">, "type"> {
  label: React.ReactNode
  hint?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, hint, className, ...props }, forwardedRef) => {
    return (
      <label className="flex cursor-pointer items-start gap-2 py-1 text-sm text-gray-900 dark:text-gray-50">
        <input
          ref={forwardedRef}
          type="checkbox"
          className={cx(
            "mt-0.5 size-4 shrink-0 cursor-pointer accent-blue-500",
            "disabled:cursor-not-allowed disabled:opacity-50",
            focusRing,
            className,
          )}
          {...props}
        />
        <span className="flex flex-col">
          <span>{label}</span>
          {hint ? (
            <span className="text-xs text-gray-500 dark:text-gray-500">
              {hint}
            </span>
          ) : null}
        </span>
      </label>
    )
  },
)
Checkbox.displayName = "Checkbox"

export { Checkbox, type CheckboxProps }
