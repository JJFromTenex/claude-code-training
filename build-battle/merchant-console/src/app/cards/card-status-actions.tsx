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
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze and cancel. router.refresh() re-renders the server
 * component against the same store, so the badge changes without a full
 * page reload. Cancelling asks first, because it cannot be undone.
 */
export function CardStatusActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function move(to: CardStatus) {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const data = await response.json()
        setError(data.message ?? "That change could not be made.")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("The console could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="py-1"
        disabled={pending}
        onClick={() => move(status === "active" ? "frozen" : "active")}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>

      <Button
        variant="ghost"
        className="py-1 text-red-600 dark:text-red-500"
        disabled={pending}
        onClick={() => setConfirming(true)}
      >
        Cancel
      </Button>

      {error && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </span>
      )}

      <Drawer open={confirming} onOpenChange={setConfirming}>
        <DrawerContent className="sm:max-w-md">
          <DrawerHeader>
            <DrawerTitle>Cancel this card?</DrawerTitle>
            <DrawerDescription>
              Cancelling is permanent.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <p className="text-sm text-gray-500">
              The card stops working immediately and cannot be reactivated. To
              pause it temporarily, freeze it instead.
            </p>
          </DrawerBody>
          <DrawerFooter>
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Keep the card
            </Button>
            <Button
              variant="destructive"
              isLoading={pending}
              onClick={() => move("cancelled")}
            >
              Cancel the card
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  )
}
