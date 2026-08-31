"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze/unfreeze/cancel a card in place — a PATCH to the state-machine
 * route, then router.refresh() to re-render the server components with the
 * new status. No client-held copy of the card, no full page reload.
 */
export function CardStatusActions({
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

  const transition = async (next: CardStatus) => {
    setPending(next)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.error ?? "Couldn't update this card.")
        return
      }
      router.refresh()
    } catch {
      setError("Couldn't reach the server.")
    } finally {
      setPending(null)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">—</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <Button
          variant="secondary"
          className="py-1.5"
          isLoading={pending === "frozen"}
          loadingText="Freezing…"
          onClick={() => transition("frozen")}
        >
          Freeze
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="py-1.5"
          isLoading={pending === "active"}
          loadingText="Unfreezing…"
          onClick={() => transition("active")}
        >
          Unfreeze
        </Button>
      )}
      {showCancel && (
        <Button
          variant="destructive"
          className="py-1.5"
          isLoading={pending === "cancelled"}
          loadingText="Cancelling…"
          onClick={() => transition("cancelled")}
        >
          Cancel card
        </Button>
      )}
      {error && (
        <p className="w-full text-sm text-red-600 dark:text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
