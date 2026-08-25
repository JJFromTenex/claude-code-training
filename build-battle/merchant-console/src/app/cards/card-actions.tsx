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

export function CardActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  if (status === "cancelled") return null

  async function transition(to: CardStatus) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message || "Failed to update card.")
        setLoading(false)
        return
      }
      router.refresh()
      setLoading(false)
      if (to === "cancelled") setCancelOpen(false)
    } catch {
      setError("Network error. Please try again.")
      setLoading(false)
    }
  }

  const toggleTarget: CardStatus = status === "active" ? "frozen" : "active"

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          className="py-1.5"
          disabled={loading}
          onClick={() => transition(toggleTarget)}
        >
          {status === "active" ? "Freeze" : "Unfreeze"}
        </Button>

        <Drawer open={cancelOpen} onOpenChange={setCancelOpen}>
          <DrawerTrigger asChild>
            <Button
              variant="destructive"
              className="py-1.5"
              disabled={loading}
            >
              Cancel card
            </Button>
          </DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Cancel this card?</DrawerTitle>
              <DrawerDescription>
                This action is permanent. A cancelled card cannot be reactivated.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              {error && cancelOpen && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Keep card</Button>
              </DrawerClose>
              <Button
                variant="destructive"
                disabled={loading}
                onClick={() => transition("cancelled")}
              >
                {loading ? "Cancelling..." : "Yes, cancel card"}
              </Button>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      </div>
      {error && !cancelOpen && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
