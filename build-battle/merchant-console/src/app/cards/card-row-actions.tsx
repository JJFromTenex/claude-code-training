"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and cancel for one card. Calls the PATCH route — where
 * the state machine is actually enforced — then `router.refresh()`, which
 * re-renders the server page in place: no full reload, and the store stays
 * the only copy of the status. Cancel is terminal, so it asks twice.
 */
export function CardRowActions({
  id,
  nickname,
  status,
}: {
  id: string
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const [busy, setBusy] = useState<CardStatus | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The spinner stays on until the refreshed row has arrived.
  useEffect(() => {
    if (!refreshing) setBusy(null)
  }, [refreshing])

  if (status === "cancelled") {
    return (
      <span className="text-sm text-gray-400 dark:text-gray-600">
        —<span className="sr-only">No actions. Cancelled cards cannot be changed.</span>
      </span>
    )
  }

  const change = async (to: CardStatus) => {
    setBusy(to)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Could not update the card. Try again.")
        setBusy(null)
        return
      }
      setConfirmingCancel(false)
      startRefresh(() => router.refresh())
    } catch {
      setError("Could not reach the console. Check the connection and try again.")
      setBusy(null)
    }
  }

  const loading = busy !== null || refreshing

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        {confirmingCancel ? (
          <>
            <Button
              variant="destructive"
              className="py-1"
              disabled={loading}
              isLoading={busy === "cancelled"}
              loadingText="Cancelling"
              onClick={() => change("cancelled")}
            >
              Confirm cancel
            </Button>
            <Button
              variant="secondary"
              className="py-1"
              disabled={loading}
              onClick={() => setConfirmingCancel(false)}
            >
              Keep
            </Button>
          </>
        ) : (
          <>
            {status === "active" ? (
              <Button
                variant="secondary"
                className="py-1"
                disabled={loading}
                isLoading={busy === "frozen"}
                loadingText="Freezing"
                aria-label={`Freeze ${nickname}`}
                onClick={() => change("frozen")}
              >
                Freeze
              </Button>
            ) : (
              <Button
                variant="secondary"
                className="py-1"
                disabled={loading}
                isLoading={busy === "active"}
                loadingText="Unfreezing"
                aria-label={`Unfreeze ${nickname}`}
                onClick={() => change("active")}
              >
                Unfreeze
              </Button>
            )}
            <Button
              variant="ghost"
              className="py-1 text-red-600 hover:text-red-700 dark:text-red-500"
              disabled={loading}
              aria-label={`Cancel ${nickname}`}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
