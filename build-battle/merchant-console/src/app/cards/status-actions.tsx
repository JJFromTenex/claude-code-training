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

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-2">
        {transitions.map((to) => (
          <Button
            key={to}
            variant={to === "cancelled" ? "destructive" : "secondary"}
            className="py-1"
            disabled={pending !== null}
            onClick={() => transitionClickHandler(to)}
          >
            {pending === to ? "Working…" : LABELS[to]}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
