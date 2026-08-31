"use client"

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
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze/unfreeze/cancel from the detail page without a full page reload —
 * PATCH, then router.refresh() to re-render the server data in place.
 * Cancel is terminal, so it's gated behind an explicit confirm rather than
 * firing on the first click.
 */
export function CardStatusActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = async (next: CardStatus) => {
    setPending(true)
    setError(null)
    const response = await fetch(`/api/cards/${cardId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    const data = await response.json()
    setPending(false)
    if (!response.ok) {
      setError(data.error ?? "Couldn't update this card.")
      return
    }
    setConfirmOpen(false)
    router.refresh()
  }

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">Cancelled — no further changes.</p>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            className="py-1.5"
            isLoading={pending}
            onClick={() => patch("frozen")}
          >
            Freeze
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="py-1.5"
            isLoading={pending}
            onClick={() => patch("active")}
          >
            Unfreeze
          </Button>
        )}

        <Drawer open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DrawerTrigger asChild>
            <Button variant="destructive" className="py-1.5">
              Cancel card
            </Button>
          </DrawerTrigger>
          <DrawerContent className="sm:max-w-sm">
            <DrawerHeader>
              <DrawerTitle>Cancel this card?</DrawerTitle>
              <DrawerDescription>
                Cancelled is terminal — this card can&apos;t be reactivated
                afterward.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody />
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Keep card</Button>
              </DrawerClose>
              <Button
                variant="destructive"
                isLoading={pending}
                onClick={() => patch("cancelled")}
              >
                Cancel card
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
