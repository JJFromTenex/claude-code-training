// Tremor Checkbox [v0.0.1]

import * as CheckboxPrimitives from "@radix-ui/react-checkbox"
import React from "react"

import { cx, focusRing } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitives.Root>,
  Omit<
    React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>,
    "asChild"
  >
>(({ className, ...props }, forwardedRef) => {
  return (
    <CheckboxPrimitives.Root
      ref={forwardedRef}
      {...props}
      className={cx(
        // base
        "relative inline-flex size-4 shrink-0 appearance-none items-center justify-center rounded shadow-sm outline-none ring-1 ring-inset transition duration-100 enabled:cursor-pointer",
        // text color
        "text-white dark:text-gray-950",
        // background color
        "bg-white dark:bg-gray-950",
        // ring color
        "ring-gray-300 dark:ring-gray-800",
        // disabled
        "data-[disabled]:bg-gray-100 data-[disabled]:text-gray-400 data-[disabled]:ring-gray-300",
        "data-[disabled]:dark:bg-gray-800 data-[disabled]:dark:text-gray-500 data-[disabled]:dark:ring-gray-700",
        // checked
        "enabled:data-[state=checked]:bg-blue-500 enabled:data-[state=checked]:ring-0 enabled:data-[state=checked]:ring-transparent",
        // indeterminate
        "enabled:data-[state=indeterminate]:bg-blue-500 enabled:data-[state=indeterminate]:ring-0 enabled:data-[state=indeterminate]:ring-transparent",
        focusRing,
        className,
      )}
    >
      <CheckboxPrimitives.Indicator className="flex size-full items-center justify-center">
        {props.checked === "indeterminate" ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            className="size-3"
          >
            <path
              d="M2.5 6H9.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            fill="none"
            className="size-3"
          >
            <path
              d="M2 6.5L4.5 9L10 3.5"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </CheckboxPrimitives.Indicator>
    </CheckboxPrimitives.Root>
  )
})

Checkbox.displayName = "Checkbox"

export { Checkbox }
