"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import type { Card, CardStatus } from "@/data/types"

function nextStatusFor(status: CardStatus): CardStatus | null {
  if (status === "active") return "frozen"
  if (status === "frozen") return "active"
  return null
}

export function CardActions({ card }: { card: Card }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const nextStatus = nextStatusFor(card.status)

  // A cancelled card is terminal: no transition control is rendered for it.
  if (card.status === "cancelled") {
    return null
  }

  const label = nextStatus === "frozen" ? "Freeze card" : "Unfreeze card"

  const handleClick = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch(`/api/cards/${card.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!response.ok) {
        const body = (await response.json()) as { message: string }
        setError(body.message)
        setSubmitting(false)
        return
      }

      setSubmitting(false)
      router.refresh()
    } catch {
      setError("Something went wrong updating the card. Try again.")
      setSubmitting(false)
    }
  }

  const handleCancelOpenChange = (next: boolean) => {
    if (!next) {
      setCancelError(null)
      setCancelling(false)
    }
    setCancelOpen(next)
  }

  const handleCancelConfirm = async () => {
    setCancelError(null)
    setCancelling(true)
    try {
      const response = await fetch(`/api/cards/${card.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })

      if (!response.ok) {
        const body = (await response.json()) as { message: string }
        setCancelError(body.message)
        setCancelling(false)
        return
      }

      setCancelling(false)
      setCancelOpen(false)
      router.refresh()
    } catch {
      setCancelError("Something went wrong cancelling the card. Try again.")
      setCancelling(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={handleClick}
          disabled={submitting}
          isLoading={submitting}
          loadingText={label}
        >
          {label}
        </Button>

        {/*
          Cancelling is terminal and irreversible, so it gets an explicit
          confirmation step rather than firing on the first click. The Drawer
          wraps Radix's dialog primitive, which already gives us the focus
          trap, Escape-to-close, and focus return to the trigger on close —
          the same guarantees a window.confirm() would give, but themeable
          and consistent with the rest of the console.
        */}
        <Drawer open={cancelOpen} onOpenChange={handleCancelOpenChange}>
          <DrawerTrigger asChild>
            <Button type="button" variant="destructive">
              Cancel card
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Cancel this card?</DrawerTitle>
              <DrawerDescription>
                Cancelling {card.nickname} (•••• {card.last4}) is permanent.
                A cancelled card cannot be reactivated or frozen again.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              {cancelError && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                >
                  {cancelError}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary" disabled={cancelling}>
                  Keep card
                </Button>
              </DrawerClose>
              <Button
                type="button"
                variant="destructive"
                onClick={handleCancelConfirm}
                disabled={cancelling}
                isLoading={cancelling}
                loadingText="Cancelling..."
              >
                Yes, cancel card
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
