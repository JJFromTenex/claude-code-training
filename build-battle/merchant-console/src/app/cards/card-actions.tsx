"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze / unfreeze / cancel from the list or the detail screen, without a
 * full page reload — `router.refresh()` re-runs the server component with
 * the store's latest state.
 */
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

  const transition = async (next: CardStatus) => {
    setPending(next)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server.")
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
        {status === "active" ? (
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending !== null}
            onClick={() => transition("frozen")}
          >
            {pending === "frozen" ? "Freezing…" : "Freeze"}
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending !== null}
            onClick={() => transition("active")}
          >
            {pending === "active" ? "Unfreezing…" : "Unfreeze"}
          </Button>
        )}
        <Button
          variant="destructive"
          className="py-1"
          disabled={pending !== null}
          onClick={() => transition("cancelled")}
        >
          {pending === "cancelled" ? "Cancelling…" : "Cancel"}
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
