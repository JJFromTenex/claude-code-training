"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Status controls for one row.
 *
 * `router.refresh()` re-renders the server component without a full page
 * reload. Cancelling is terminal, so it asks first — but the server is what
 * actually guards the transition; this only decides what to offer.
 */
export function CardStatusActions({
  id,
  nickname,
  status,
}: {
  id: string
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<CardStatus | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">Cancelled</span>
  }

  const change = async (next: CardStatus) => {
    setBusy(next)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.message ?? "Could not change the status.")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(null)
    }
  }

  const freezeTarget: CardStatus = status === "active" ? "frozen" : "active"

  return (
    <div className="flex flex-col items-end gap-1">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}

      {confirming ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Cancel for good?</span>
          <Button
            variant="secondary"
            className="py-1"
            onClick={() => setConfirming(false)}
            disabled={busy !== null}
          >
            Keep
          </Button>
          <Button
            variant="destructive"
            className="py-1"
            onClick={() => change("cancelled")}
            isLoading={busy === "cancelled"}
            loadingText="Cancelling"
            aria-label={`Confirm cancelling ${nickname}. This cannot be undone.`}
          >
            Yes, cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="py-1"
            onClick={() => change(freezeTarget)}
            isLoading={busy === freezeTarget}
            loadingText={status === "active" ? "Freezing" : "Unfreezing"}
            aria-label={`${status === "active" ? "Freeze" : "Unfreeze"} ${nickname}`}
          >
            {status === "active" ? "Freeze" : "Unfreeze"}
          </Button>
          <Button
            variant="ghost"
            className="py-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            onClick={() => setConfirming(true)}
            aria-label={`Cancel ${nickname}`}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
