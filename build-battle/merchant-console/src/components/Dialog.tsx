// Tremor Dialog [v0.0.1]

import * as DialogPrimitives from "@radix-ui/react-dialog"
import { RiCloseLine } from "@remixicon/react"
import * as React from "react"

import { cx, focusRing } from "@/lib/utils"

import { Button } from "./Button"

/**
 * Centred modal dialog.
 *
 * The console already had `Drawer` for side panels; this is its counterpart
 * for a short, focused decision that belongs over the page rather than beside
 * it. Both wrap the same Radix primitive, so focus trapping, Escape-to-close,
 * and the aria wiring come from one place.
 */

const Dialog = (
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitives.Root>,
) => {
  return <DialogPrimitives.Root tremor-id="tremor-raw" {...props} />
}
Dialog.displayName = "Dialog"

const DialogTrigger = DialogPrimitives.Trigger
DialogTrigger.displayName = "DialogTrigger"

const DialogClose = DialogPrimitives.Close
DialogClose.displayName = "DialogClose"

const DialogPortal = DialogPrimitives.Portal
DialogPortal.displayName = "DialogPortal"

const DialogOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Overlay>
>(({ className, ...props }, forwardedRef) => {
  return (
    <DialogPrimitives.Overlay
      ref={forwardedRef}
      className={cx(
        // base
        "fixed inset-0 z-50 overflow-y-auto",
        // background color
        "bg-black/30",
        // transition
        "data-[state=closed]:animate-hide",
        className,
      )}
      {...props}
    />
  )
})

DialogOverlay.displayName = "DialogOverlay"

const DialogContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Content>
>(({ className, ...props }, forwardedRef) => {
  return (
    <DialogPortal>
      <DialogOverlay>
        <DialogPrimitives.Content
          ref={forwardedRef}
          className={cx(
            // base
            "fixed left-1/2 top-1/2 z-50 flex max-h-[85vh] w-[95vw] -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-md border p-6 shadow-lg focus:outline-none sm:max-w-lg",
            // border color
            "border-gray-200 dark:border-gray-900",
            // background color
            "bg-white dark:bg-[#090E1A]",
            // transition
            "data-[state=open]:animate-slideUpAndFade",
            focusRing,
            className,
          )}
          {...props}
        />
      </DialogOverlay>
    </DialogPortal>
  )
})

DialogContent.displayName = "DialogContent"

const DialogHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ children, className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className="flex items-start justify-between gap-x-4 border-b border-gray-200 pb-4 dark:border-gray-900"
      {...props}
    >
      <div className={cx("flex flex-col gap-y-1", className)}>{children}</div>
      <DialogPrimitives.Close asChild>
        <Button
          variant="ghost"
          className="aspect-square p-1 hover:bg-gray-100 hover:dark:bg-gray-400/10"
          aria-label="Close"
        >
          <RiCloseLine className="size-6" aria-hidden="true" />
        </Button>
      </DialogPrimitives.Close>
    </div>
  )
})

DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Title
    ref={forwardedRef}
    className={cx(
      // base
      "text-base font-semibold",
      // text color
      "text-gray-900 dark:text-gray-50",
      className,
    )}
    {...props}
  />
))

DialogTitle.displayName = "DialogTitle"

const DialogDescription = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Description>
>(({ className, ...props }, forwardedRef) => {
  return (
    <DialogPrimitives.Description
      ref={forwardedRef}
      className={cx("text-sm text-gray-500 dark:text-gray-500", className)}
      {...props}
    />
  )
})

DialogDescription.displayName = "DialogDescription"

const DialogBody = React.forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<"div">
>(({ className, ...props }, ref) => {
  return <div ref={ref} className={cx("flex-1 py-4", className)} {...props} />
})

DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => {
  return (
    <div
      className={cx(
        "flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-end dark:border-gray-900",
        className,
      )}
      {...props}
    />
  )
}

DialogFooter.displayName = "DialogFooter"

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
}
