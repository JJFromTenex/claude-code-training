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
import { CardStatus } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { useRouter } from "next/navigation"
import * as React from "react"

/**
 * Freeze, unfreeze, and cancel.
 *
 * The status change goes to `PATCH /api/cards/[id]/status`, which is where the
 * state machine is enforced; `router.refresh()` re-renders the server
 * components with the new status without a page load. Disabled buttons here
 * are a convenience, never the guard.
 *
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
  const [confirmingCancel, setConfirmingCancel] = React.useState(false)

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

      setConfirmingCancel(false)
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

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          className="py-1"
          isLoading={pending === (status === "frozen" ? "active" : "frozen")}
          onClick={() => move(status === "frozen" ? "active" : "frozen")}
        >
          {status === "frozen" ? "Unfreeze" : "Freeze"}
        </Button>
        <Button
          variant="ghost"
          className="py-1 text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-400/10"
          onClick={() => setConfirmingCancel(true)}
        >
          Cancel
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-right text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}

      <Drawer open={confirmingCancel} onOpenChange={setConfirmingCancel}>
        <DrawerContent className="sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Cancel {nickname}?</DrawerTitle>
            <DrawerDescription>
              Cancelling is permanent. {maskCardNumber(last4)} will stop
              authorising immediately and cannot be brought back.
            </DrawerDescription>
          </DrawerHeader>

          <DrawerBody>
            <p className="text-sm text-gray-500">
              If the card only needs to stop for now, freeze it instead. A
              frozen card can be unfrozen.
            </p>
          </DrawerBody>

          <DrawerFooter className="gap-2">
            <Button
              variant="secondary"
              className="w-full sm:w-fit"
              onClick={() => setConfirmingCancel(false)}
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
  )
}
