"use client"

import { Button } from "@/components/Button"
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
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const moves = allowedTransitions(status)
  if (moves.length === 0) return null

  const move = async (next: CardStatus) => {
    if (next === "cancelled") {
      const ok = window.confirm(
        "Cancelling is permanent. This card cannot be reactivated. Continue?",
      )
      if (!ok) return
    }

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
        {moves.map((next) => (
          <Button
            key={next}
            variant={next === "cancelled" ? "ghost" : "secondary"}
            className="py-1"
            disabled={pending !== null}
            isLoading={pending === next}
            onClick={() => move(next)}
          >
            {ACTION_LABELS[next]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
