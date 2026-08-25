"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { CardStatus } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { useRouter } from "next/navigation"
import * as React from "react"

/**
 * Freeze, unfreeze, and cancel.
 *
 * The change goes to `PATCH /api/cards/[id]/status`, where the state machine
 * is enforced; `router.refresh()` re-renders the server components without a
 * page load. Disabled buttons here are a convenience, never the guard.
 * Cancelling is terminal, so it asks first.
 */
export function CardActions({
  cardId,
  nickname,
  last4,
  status,
}: {
  cardId: string
  nickname: string
  last4: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState<CardStatus | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [confirming, setConfirming] = React.useState(false)

  const move = async (next: CardStatus) => {
    setPending(next)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.message ?? "That change was refused.")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("The console could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  const unfreezing = status === "frozen"

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          className="py-1"
          isLoading={pending === (unfreezing ? "active" : "frozen")}
          onClick={() => move(unfreezing ? "active" : "frozen")}
        >
          {unfreezing ? "Unfreeze" : "Freeze"}
        </Button>

        <Drawer open={confirming} onOpenChange={setConfirming}>
          <DrawerTrigger asChild>
            <Button
              variant="ghost"
              className="py-1 text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-400/10"
            >
              Cancel
            </Button>
          </DrawerTrigger>
          <DrawerContent className="sm:max-w-md">
            <DrawerHeader>
              <DrawerTitle>Cancel {nickname}?</DrawerTitle>
              <DrawerDescription>
                Cancelling is permanent. {maskCardNumber(last4)} stops
                authorising immediately and cannot be brought back. If it only
                needs to stop for now, freeze it instead.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerFooter className="gap-2">
              <Button
                variant="secondary"
                className="w-full sm:w-fit"
                onClick={() => setConfirming(false)}
              >
                Keep the card
              </Button>
              <Button
                variant="destructive"
                className="w-full sm:w-fit"
                isLoading={pending === "cancelled"}
                loadingText="Cancelling"
                onClick={() => move("cancelled")}
              >
                Cancel this card
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>

      {/* Announced, because the only other signal is a badge changing colour. */}
      <p aria-live="polite" className="sr-only">
        {pending ? "" : `${nickname} is ${status}`}
      </p>
      {error && (
        <p role="alert" className="text-right text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
