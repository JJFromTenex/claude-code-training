"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel from the list.
 *
 * The row re-renders from the server response without a page reload. Which
 * buttons appear is a convenience; the server decides what is actually
 * allowed, and a refused transition comes back here as a message.
 */
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

  async function move(next: CardStatus) {
    if (pending) return
    setPending(next)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const payload = await response.json()
        setError(payload.error ?? "That change was refused.")
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
    return <span className="text-sm text-gray-500">—</span>
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            className="py-1"
            isLoading={pending === "frozen"}
            loadingText="Freezing"
            aria-label={`Freeze ${nickname}`}
            onClick={() => move("frozen")}
          >
            Freeze
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="py-1"
            isLoading={pending === "active"}
            loadingText="Unfreezing"
            aria-label={`Unfreeze ${nickname}`}
            onClick={() => move("active")}
          >
            Unfreeze
          </Button>
        )}
        <Button
          variant="ghost"
          className="py-1 text-red-600 dark:text-red-500"
          isLoading={pending === "cancelled"}
          loadingText="Cancelling"
          aria-label={`Cancel ${nickname}`}
          onClick={() => move("cancelled")}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
