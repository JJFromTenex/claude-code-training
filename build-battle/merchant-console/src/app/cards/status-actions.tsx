"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { allowedTransitions } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel controls.
 *
 * Which buttons render comes from the same transition table the server guards
 * with, so the UI cannot offer an illegal move — but the server still checks,
 * because a hidden button is not a rule.
 */

const LABELS: Record<CardStatus, string> = {
  active: "Unfreeze",
  frozen: "Freeze",
  cancelled: "Cancel card",
}

export function CardStatusActions({
  cardId,
  status,
  size = "compact",
}: {
  cardId: string
  status: CardStatus
  size?: "compact" | "full"
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Cancelling is terminal, so it takes a second, deliberate click. */
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const transitions = allowedTransitions(status)
  if (transitions.length === 0) {
    return (
      <span className="text-sm text-gray-500">
        {size === "full" ? "Cancelled cards cannot be changed." : "—"}
      </span>
    )
  }

  const transitionClickHandler = async (to: CardStatus) => {
    setError(null)
    setPending(to)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        setError(body.message ?? "Could not update the card.")
        return
      }
      // Re-render the server component in place: no full page reload.
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(null)
    }
  }

  const cancelClickHandler = () => {
    if (!confirmingCancel) {
      setConfirmingCancel(true)
      return
    }
    setConfirmingCancel(false)
    transitionClickHandler("cancelled")
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {transitions
          .filter((to) => to !== "cancelled")
          .map((to) => (
            <Button
              key={to}
              variant="secondary"
              className="py-1"
              disabled={pending !== null}
              onClick={() => transitionClickHandler(to)}
            >
              {pending === to ? "Working…" : LABELS[to]}
            </Button>
          ))}

        {transitions.includes("cancelled") && (
          <>
            <Button
              variant="destructive"
              className="py-1"
              disabled={pending !== null}
              onClick={cancelClickHandler}
            >
              {pending === "cancelled"
                ? "Working…"
                : confirmingCancel
                  ? "Confirm — cannot be undone"
                  : LABELS.cancelled}
            </Button>
            {confirmingCancel && pending === null && (
              <Button
                variant="ghost"
                className="py-1"
                onClick={() => setConfirmingCancel(false)}
              >
                Keep card
              </Button>
            )}
          </>
        )}
      </div>
      {confirmingCancel && pending === null && (
        <p className="text-xs text-gray-500">
          Cancelling is permanent — the card cannot be reactivated.
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
