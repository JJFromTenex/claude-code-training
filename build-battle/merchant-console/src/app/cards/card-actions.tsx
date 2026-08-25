"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Status controls for a card. The server owns the state machine; these
 * buttons only offer the moves it would accept, and cancelling asks first
 * because nothing comes back from it.
 */
export function CardActions({
  cardId,
  status,
  size = "default",
}: {
  cardId: string
  status: CardStatus
  /** "compact" for a table row, "default" for the detail page. */
  size?: "default" | "compact"
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const busy = pending !== null

  const change = async (next: CardStatus) => {
    if (busy) return
    setPending(next)
    setError(null)

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error ?? "Could not update the card.")
        return
      }

      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("Could not reach the server. Nothing changed.")
    } finally {
      setPending(null)
    }
  }

  // Terminal. Say so rather than showing buttons that would be rejected.
  if (status === "cancelled") {
    return (
      <span className="text-sm text-gray-500">No actions — card cancelled</span>
    )
  }

  const buttonClass = size === "compact" ? "py-1 text-xs" : "py-1.5"

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="flex flex-wrap gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            className={buttonClass}
            isLoading={pending === "frozen"}
            loadingText="Freezing..."
            disabled={busy}
            onClick={() => change("frozen")}
          >
            Freeze
          </Button>
        ) : (
          <Button
            variant="secondary"
            className={buttonClass}
            isLoading={pending === "active"}
            loadingText="Unfreezing..."
            disabled={busy}
            onClick={() => change("active")}
          >
            Unfreeze
          </Button>
        )}

        {confirmingCancel ? (
          <>
            <Button
              variant="destructive"
              className={buttonClass}
              isLoading={pending === "cancelled"}
              loadingText="Cancelling..."
              disabled={busy}
              onClick={() => change("cancelled")}
            >
              Confirm cancel
            </Button>
            <Button
              variant="ghost"
              className={buttonClass}
              disabled={busy}
              onClick={() => setConfirmingCancel(false)}
            >
              Keep card
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            className={buttonClass}
            disabled={busy}
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel card
          </Button>
        )}
      </div>

      {confirmingCancel && !error && (
        <p className="text-xs text-gray-500">
          Cancelling is permanent. The card cannot be reactivated.
        </p>
      )}

      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
