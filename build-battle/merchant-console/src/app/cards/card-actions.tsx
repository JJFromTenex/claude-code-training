"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * The server owns the state machine. This only offers the moves it allows and
 * shows whatever the route says when it refuses one.
 */
export function CardActions({
  cardId,
  status,
  showCancel = false,
}: {
  cardId: string
  status: CardStatus
  showCancel?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function move(next: CardStatus) {
    setPending(next)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.error ?? "That change was refused.")
        return
      }
      // Re-renders the server component in place; no full page reload.
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            className="py-1"
            isLoading={pending === "frozen"}
            onClick={() => move("frozen")}
          >
            Freeze
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="py-1"
            isLoading={pending === "active"}
            onClick={() => move("active")}
          >
            Unfreeze
          </Button>
        )}

        {showCancel && (
          <Button
            variant="destructive"
            className="py-1"
            isLoading={pending === "cancelled"}
            onClick={() => move("cancelled")}
          >
            Cancel card
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
