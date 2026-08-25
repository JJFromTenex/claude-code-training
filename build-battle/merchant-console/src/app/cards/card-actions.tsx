"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze / unfreeze / cancel a card in place. PATCHes the server, which owns
 * the state machine, then refreshes server data — no full page reload.
 */
export function CardActions({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function transition(to: CardStatus) {
    setPending(to)
    setError(null)
    try {
      let res: Response
      try {
        res = await fetch(`/api/cards/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: to }),
        })
      } catch {
        setError("Could not reach the server. Check your connection and try again.")
        return
      }

      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        setError(data?.errors?.[0] ?? "Could not update the card.")
        return
      }
      router.refresh()
    } finally {
      setPending(null)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">Cancelled</span>
  }

  return (
    <div className="flex items-center gap-2">
      {status === "active" ? (
        <Button
          variant="secondary"
          className="py-1.5"
          disabled={pending !== null}
          onClick={() => transition("frozen")}
        >
          {pending === "frozen" ? "Freezing…" : "Freeze"}
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="py-1.5"
          disabled={pending !== null}
          onClick={() => transition("active")}
        >
          {pending === "active" ? "Unfreezing…" : "Unfreeze"}
        </Button>
      )}
      <Button
        variant="destructive"
        className="py-1.5"
        disabled={pending !== null}
        onClick={() => {
          if (window.confirm("Cancel this card? Cancellation cannot be undone.")) {
            transition("cancelled")
          }
        }}
      >
        {pending === "cancelled" ? "Cancelling…" : "Cancel"}
      </Button>
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </div>
  )
}
