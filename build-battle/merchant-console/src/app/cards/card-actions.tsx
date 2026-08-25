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
  DrawerTrigger,
} from "@/components/Drawer"
import { CardStatus } from "@/data/types"
import { allowedTransitions } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, or cancel a card without a full page reload.
 *
 * The buttons offered come from the same transition table the route guards
 * with, so the UI cannot suggest a move the server will refuse. The server is
 * still the enforcement: a stale tab gets a 409 and the message is shown.
 */

const ACTION_LABELS: Record<CardStatus, string> = {
  active: "Unfreeze",
  frozen: "Freeze",
  cancelled: "Cancel card",
}

export function CardActions({
  cardId,
  nickname,
  status,
}: {
  cardId: string
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  const moves = allowedTransitions(status)
  if (moves.length === 0) return null

  const move = async (next: CardStatus) => {
    setError(null)
    setPending(next)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "Could not update the card.")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {moves.map((next) =>
          next === "cancelled" ? (
            // Cancelling is terminal, so it asks first — in an accessible
            // dialog rather than a native confirm, which cannot be styled,
            // labelled, or tested the way the rest of the console is.
            <Drawer key={next} open={confirming} onOpenChange={setConfirming}>
              <DrawerTrigger asChild>
                <Button
                  variant="ghost"
                  className="py-1"
                  disabled={pending !== null}
                >
                  {ACTION_LABELS[next]}
                </Button>
              </DrawerTrigger>

              <DrawerContent className="sm:max-w-sm">
                <DrawerHeader>
                  <DrawerTitle>Cancel this card?</DrawerTitle>
                  <DrawerDescription className="text-sm">
                    Cancelling is permanent.
                  </DrawerDescription>
                </DrawerHeader>

                <DrawerBody>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-gray-50">
                      {nickname}
                    </span>{" "}
                    will stop working immediately and cannot be reactivated.
                    Anything paying with it will fail on the next charge.
                  </p>
                </DrawerBody>

                <DrawerFooter className="gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => setConfirming(false)}
                    disabled={pending !== null}
                  >
                    Keep card
                  </Button>
                  <Button
                    variant="destructive"
                    isLoading={pending === "cancelled"}
                    loadingText="Cancelling"
                    onClick={() => move("cancelled")}
                  >
                    Cancel card
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : (
            <Button
              key={next}
              variant="secondary"
              className="py-1"
              disabled={pending !== null}
              isLoading={pending === next}
              onClick={() => move(next)}
            >
              {ACTION_LABELS[next]}
            </Button>
          ),
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
