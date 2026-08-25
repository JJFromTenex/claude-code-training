"use client"

import { Button } from "@/components/Button"
import { Card } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel from wherever the card is shown.
 *
 * The server owns the transition rules; this only offers the moves that are
 * legal from here and refreshes the route on success, so the list updates
 * without a full page load.
 */
export function StatusActions({
  card,
  showCancel = false,
}: {
  card: Pick<Card, "id" | "status">
  showCancel?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (card.status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  const move = async (status: "active" | "frozen" | "cancelled") => {
    setPending(status)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.message ?? "That change could not be saved.")
      }
      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong.")
    } finally {
      setPending(null)
    }
  }

  const next = card.status === "active" ? "frozen" : "active"
  const label = card.status === "active" ? "Freeze" : "Unfreeze"

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="py-1"
          disabled={pending !== null}
          onClick={() => move(next)}
        >
          {pending === next ? `${label}…` : label}
        </Button>
        {showCancel && (
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending !== null}
            onClick={() => move("cancelled")}
          >
            {pending === "cancelled" ? "Cancelling…" : "Cancel card"}
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
