// Tremor RadioGroup [v0.0.1]

import * as RadioGroupPrimitives from "@radix-ui/react-radio-group"
import React from "react"

import { cx, focusRing } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitives.Root>
>(({ className, ...props }, forwardedRef) => {
  return (
    <RadioGroupPrimitives.Root
      ref={forwardedRef}
      className={cx("grid gap-2", className)}
      {...props}
    />
  )
})

RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitives.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitives.Item>
>(({ className, ...props }, forwardedRef) => {
  return (
    <RadioGroupPrimitives.Item
      ref={forwardedRef}
      {...props}
      className={cx(
        // base
        "group relative flex size-4 shrink-0 appearance-none items-center justify-center rounded-full shadow-sm outline-none ring-1 ring-inset transition enabled:cursor-pointer",
        // background color
        "bg-white dark:bg-gray-950",
        // ring color
        "ring-gray-300 dark:ring-gray-800",
        // disabled
        "data-[disabled]:bg-gray-100 data-[disabled]:ring-gray-300",
        "data-[disabled]:dark:bg-gray-800 data-[disabled]:dark:ring-gray-700",
        // checked
        "enabled:data-[state=checked]:bg-blue-500 enabled:data-[state=checked]:ring-0 enabled:data-[state=checked]:ring-transparent",
        focusRing,
        className,
      )}
    >
      <RadioGroupPrimitives.Indicator className="flex items-center justify-center">
        <div
          className={cx(
            // base
            "size size-1.5 shrink-0 rounded-full",
            // indicator
            "bg-white",
            // disabled
            "group-data-[disabled]:bg-gray-400 group-data-[disabled]:dark:bg-gray-500",
          )}
        />
      </RadioGroupPrimitives.Indicator>
    </RadioGroupPrimitives.Item>
  )
})

RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
