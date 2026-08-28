// Dialog, built on the same Radix primitive as Drawer.tsx but centered.

"use client"

import { RiCloseLine } from "@remixicon/react"
import * as DialogPrimitives from "@radix-ui/react-dialog"
import * as React from "react"

import { cx, focusRing } from "@/lib/utils"
import { Button } from "./Button"

/**
 * Radix handles the focus trap, the focus return to the trigger, and Escape
 * to close on its own. Do not override onEscapeKeyDown or onOpenAutoFocus —
 * the accessibility rules in .claude/rules/components.md are satisfied by
 * leaving those alone. Always render a DialogTitle so the dialog has a name.
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
        "fixed inset-0 z-50 overflow-y-auto",
        "bg-black/30 dark:bg-black/60",
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
            "fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2",
            "w-[95vw] max-w-lg max-h-[85vh] overflow-y-auto",
            "rounded-md border p-4 shadow-lg sm:p-6",
            "border-gray-200 dark:border-gray-900",
            "bg-white dark:bg-[#090E1A]",
            "data-[state=open]:animate-slideUpAndFade data-[state=closed]:animate-hide",
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

const DialogHeader = ({
  children,
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  return (
    <div className={cx("flex items-start justify-between gap-4", className)} {...props}>
      <div className="flex flex-col gap-1">{children}</div>
      <DialogPrimitives.Close asChild>
        <Button variant="ghost" className="aspect-square p-1">
          <RiCloseLine className="size-5 shrink-0" aria-hidden="true" />
          <span className="sr-only">Close</span>
        </Button>
      </DialogPrimitives.Close>
    </div>
  )
}
DialogHeader.displayName = "DialogHeader"

const DialogTitle = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitives.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitives.Title>
>(({ className, ...props }, forwardedRef) => (
  <DialogPrimitives.Title
    ref={forwardedRef}
    className={cx(
      "text-base font-semibold",
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
      className={cx("text-gray-500 dark:text-gray-500", className)}
      {...props}
    />
  )
})
DialogDescription.displayName = "DialogDescription"

const DialogBody = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  return <div className={cx("my-4", className)} {...props} />
}
DialogBody.displayName = "DialogBody"

const DialogFooter = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) => {
  return (
    <div
      className={cx(
        "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end",
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
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
