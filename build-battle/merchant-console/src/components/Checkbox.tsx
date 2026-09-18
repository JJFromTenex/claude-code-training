// Tremor Checkbox [v0.0.1]

import * as CheckboxPrimitives from "@radix-ui/react-checkbox"
import { RiCheckLine } from "@remixicon/react"
import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitives.Root>
>(({ className, ...props }, forwardedRef) => {
  return (
    <CheckboxPrimitives.Root
      ref={forwardedRef}
      className={cx(
        // base
        "relative inline-flex size-4 shrink-0 appearance-none items-center justify-center rounded border shadow-sm outline-none",
        // border color
        "border-gray-300 dark:border-gray-800",
        // background color
        "bg-white dark:bg-gray-950",
        // checked
        "data-[state=checked]:border-0 data-[state=checked]:bg-blue-500 dark:data-[state=checked]:bg-blue-500",
        // disabled
        "data-[disabled]:border-gray-300 data-[disabled]:bg-gray-100 data-[disabled]:text-gray-400",
        "data-[disabled]:dark:border-gray-700 data-[disabled]:dark:bg-gray-800",
        focusRing,
        className,
      )}
      {...props}
    >
      <CheckboxPrimitives.Indicator className="flex items-center justify-center text-white">
        <RiCheckLine className="size-3 shrink-0" aria-hidden="true" />
      </CheckboxPrimitives.Indicator>
    </CheckboxPrimitives.Root>
  )
})

Checkbox.displayName = "Checkbox"

export { Checkbox }
