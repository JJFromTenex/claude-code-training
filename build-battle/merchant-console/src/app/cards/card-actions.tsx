"use client"

import { Button } from "@/components/Button"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { CardStatus } from "@/data/types"
import { useState } from "react"

/**
 * Status badge plus freeze/unfreeze, updated in place from the server's
 * response — no navigation, no reload. The server guards the state machine;
 * this only offers the transitions that are legal from where the card is.
 */
export function CardStatusActions({
  cardId,
  initialStatus,
}: {
  cardId: string
  initialStatus: CardStatus
}) {
  const [status, setStatus] = useState<CardStatus>(initialStatus)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const transition = async (to: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "The status change failed.")
        return
      }
      setStatus(payload.card.status)
      setConfirmingCancel(false)
    } catch {
      setError("The status change failed. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <CardStatusBadge status={status} />
      {status === "active" && (
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={pending}
          onClick={() => transition("frozen")}
        >
          Freeze
        </Button>
      )}
      {status === "frozen" && (
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          disabled={pending}
          onClick={() => transition("active")}
        >
          Unfreeze
        </Button>
      )}
      {status !== "cancelled" &&
        (confirmingCancel ? (
          <span className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
            Cancel for good?
            <Button
              variant="destructive"
              className="px-2 py-1 text-xs"
              disabled={pending}
              onClick={() => transition("cancelled")}
            >
              Yes, cancel
            </Button>
            <Button
              variant="ghost"
              className="px-2 py-1 text-xs"
              disabled={pending}
              onClick={() => setConfirmingCancel(false)}
            >
              Keep
            </Button>
          </span>
        ) : (
          <Button
            variant="ghost"
            className="px-2 py-1 text-xs"
            disabled={pending}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel…
          </Button>
        ))}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
