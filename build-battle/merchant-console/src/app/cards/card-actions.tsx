"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel from wherever a card is shown, without a full
 * page reload. The server still decides whether the transition is legal — this
 * only hides the buttons that obviously are not.
 */
export function CardActions({
  cardId,
  status,
  allowCancel = false,
}: {
  cardId: string
  status: CardStatus
  allowCancel?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Cancelling is terminal, so it asks first. Freezing is reversible. */
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  async function move(to: CardStatus) {
    setPending(to)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.message ?? "That change could not be applied.")
        return
      }
      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("Could not reach the server. Retry in a moment.")
    } finally {
      setPending(null)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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

      {allowCancel &&
        (confirmingCancel ? (
          // Inline and non-modal, so not an alertdialog: that role promises
          // focus is trapped. The question announces itself instead, and
          // focus moves to the confirming button.
          <div
            role="group"
            aria-label="Confirm cancelling this card"
            className="flex flex-wrap items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900 dark:bg-red-950/40"
          >
            <p role="alert" className="text-sm text-red-900 dark:text-red-100">
              Cancel this card for good? It cannot be brought back.
            </p>
            <Button
              variant="destructive"
              className="py-1"
              isLoading={pending === "cancelled"}
              onClick={() => move("cancelled")}
              autoFocus
            >
              Yes, cancel it
            </Button>
            <Button
              variant="secondary"
              className="py-1"
              onClick={() => setConfirmingCancel(false)}
            >
              Keep the card
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            className="py-1"
            onClick={() => setConfirmingCancel(true)}
          >
            Cancel card
          </Button>
        ))}

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
