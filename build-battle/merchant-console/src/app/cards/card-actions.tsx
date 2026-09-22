"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and cancel from wherever a card is listed.
 *
 * The status machine is enforced by `PATCH /api/cards/[id]`; this only offers
 * the moves that route would accept, and reports it when the server disagrees
 * anyway. `router.refresh()` re-renders the server component in place, so the
 * badge changes without a full page reload.
 */
export function CardActions({
  cardId,
  status,
  nickname,
}: {
  cardId: string
  status: CardStatus
  nickname: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const change = async (next: CardStatus) => {
    setBusy(true)
    setError(null)

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.message ?? "That change could not be saved.")
        return
      }

      startTransition(() => router.refresh())
    } catch {
      setError("The console could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  // Cancelled is terminal, so there is nothing to offer.
  if (status === "cancelled") {
    return <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
  }

  const working = busy || pending

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </span>
      )}

      <Button
        variant="secondary"
        className="py-1"
        disabled={working}
        onClick={() => {
          setConfirmingCancel(false)
          change(status === "active" ? "frozen" : "active")
        }}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
        <span className="sr-only"> {nickname}</span>
      </Button>

      {/* Cancelling is terminal, so it takes a second click rather than one. */}
      {confirmingCancel ? (
        <>
          <Button
            variant="destructive"
            className="py-1"
            disabled={working}
            onClick={() => change("cancelled")}
          >
            Confirm
            <span className="sr-only">
              {" "}
              cancelling {nickname}. This cannot be undone.
            </span>
          </Button>
          <Button
            variant="ghost"
            className="py-1"
            disabled={working}
            onClick={() => setConfirmingCancel(false)}
          >
            Keep
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          className="py-1 text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-950/40"
          disabled={working}
          onClick={() => setConfirmingCancel(true)}
        >
          Cancel
          <span className="sr-only"> {nickname}</span>
        </Button>
      )}
    </div>
  )
}
