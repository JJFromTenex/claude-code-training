"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { nextStatuses } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState } from "react"

const ACTION_LABELS: Record<CardStatus, string> = {
  active: "Unfreeze",
  frozen: "Freeze",
  cancelled: "Cancel card",
}

/**
 * Freeze, unfreeze, or cancel without leaving the page. The server guards
 * the state machine; this only offers the moves it would accept. Cancel is
 * terminal, so it asks once before it sends.
 */
export function CardStatusActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const moves = nextStatuses(status)
  if (moves.length === 0) return null

  const transition = async (to: CardStatus) => {
    setPending(to)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          message?: string
        } | null
        setError(body?.message ?? "The card could not be updated. Try again.")
        return
      }
      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("The console could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {moves.map((to) =>
        to === "cancelled" && !confirmingCancel ? (
          <Button
            key={to}
            variant="ghost"
            className="py-1 text-red-600 dark:text-red-500"
            disabled={pending !== null}
            onClick={() => setConfirmingCancel(true)}
          >
            {ACTION_LABELS[to]}
          </Button>
        ) : to === "cancelled" ? (
          <span key={to} className="flex items-center gap-2">
            <Button
              variant="destructive"
              className="py-1"
              isLoading={pending === to}
              loadingText="Cancelling"
              disabled={pending !== null}
              onClick={() => transition(to)}
            >
              Confirm cancel
            </Button>
            <Button
              variant="ghost"
              className="py-1"
              disabled={pending !== null}
              onClick={() => setConfirmingCancel(false)}
            >
              Keep
            </Button>
          </span>
        ) : (
          <Button
            key={to}
            variant="secondary"
            className="py-1"
            isLoading={pending === to}
            loadingText={to === "frozen" ? "Freezing" : "Unfreezing"}
            disabled={pending !== null}
            onClick={() => transition(to)}
          >
            {ACTION_LABELS[to]}
          </Button>
        ),
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
