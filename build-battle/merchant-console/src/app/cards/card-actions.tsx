"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel from the list, without a full page reload.
 * The server owns the state machine; these buttons only offer the transitions
 * it would accept, and surface its refusal when it does not.
 */
export function CardActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Cancelling is terminal, so it asks first. One click arms, the next commits.
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const move = async (next: CardStatus) => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.message ?? "That change was refused.")
        return
      }
      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
  }

  if (confirmingCancel) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-gray-500" role="alert">
          Cancel this card? It cannot be undone.
        </span>
        <Button
          variant="secondary"
          className="py-1 text-xs"
          disabled={busy}
          onClick={() => setConfirmingCancel(false)}
        >
          Keep it
        </Button>
        <Button
          variant="destructive"
          className="py-1 text-xs"
          disabled={busy}
          onClick={() => move("cancelled")}
        >
          Yes, cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        className="py-1 text-xs"
        disabled={busy}
        onClick={() => move(status === "active" ? "frozen" : "active")}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>
      <Button
        variant="secondary"
        className="py-1 text-xs"
        disabled={busy}
        onClick={() => setConfirmingCancel(true)}
      >
        Cancel
      </Button>
    </div>
  )
}
