"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { Card, CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CardActions({ card }: { card: Card }) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  // Cancelled is terminal: no toggle, no reactivate, nothing to click.
  if (card.status === "cancelled") {
    return null
  }

  const patch = async (nextStatus: CardStatus) => {
    setIsPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = await response.json()

      if (!response.ok) {
        setError(body?.message ?? "Something went wrong. Try again.")
        return
      }

      setConfirmOpen(false)
      router.refresh()
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          className="py-1.5"
          disabled={isPending}
          onClick={() => patch(card.status === "active" ? "frozen" : "active")}
        >
          {card.status === "active" ? "Freeze" : "Unfreeze"}
        </Button>
        <Button
          variant="destructive"
          className="py-1.5"
          disabled={isPending}
          onClick={() => {
            setError(null)
            setConfirmOpen(true)
          }}
        >
          Cancel
        </Button>
      </div>

      {error && (
        <p className="max-w-64 text-right text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}

      <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Cancel {card.nickname}?</DrawerTitle>
            <DrawerDescription>
              Cancelling is permanent and cannot be undone. The card will stop
              working immediately and cannot be reactivated afterward.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            {error && (
              <p className="text-sm text-red-600 dark:text-red-500">
                {error}
              </p>
            )}
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="secondary"
              disabled={isPending}
              onClick={() => setConfirmOpen(false)}
            >
              Keep card
            </Button>
            <Button
              variant="destructive"
              disabled={isPending}
              isLoading={isPending}
              loadingText="Cancelling…"
              onClick={() => patch("cancelled")}
            >
              Cancel card
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
