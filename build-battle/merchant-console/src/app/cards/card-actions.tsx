"use client"

import { Button } from "@/components/Button"
import { Card, CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel from the list.
 *
 * The server owns the state machine — `cancelled` is terminal there whatever
 * this component renders — so a refused transition is surfaced rather than
 * pre-empted, and the row re-reads from the server after every change.
 */
export function CardActions({ card }: { card: Card }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (card.status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const move = async (status: CardStatus) => {
    if (status === "cancelled") {
      const sure = window.confirm(
        `Cancel ${card.nickname}? A cancelled card cannot be reactivated.`,
      )
      if (!sure) return
    }

    setPending(true)
    setError(null)

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const payload = await response.json()
        setError(payload.message ?? "That change was refused.")
        return
      }

      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error !== null && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        className="py-1"
        disabled={pending}
        onClick={() => move(card.status === "frozen" ? "active" : "frozen")}
      >
        {card.status === "frozen" ? "Unfreeze" : "Freeze"}
      </Button>
      <Button
        variant="ghost"
        className="py-1 text-red-600 dark:text-red-500"
        disabled={pending}
        onClick={() => move("cancelled")}
      >
        Cancel
      </Button>
    </div>
  )
}
