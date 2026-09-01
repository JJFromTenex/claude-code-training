"use client"

import { useState } from "react"
import { Button } from "@/components/Button"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { CardStatus } from "@/data/types"

/**
 * Client-side visibility only — which buttons make sense to show for the
 * current status. The transition itself is enforced by the server in
 * PATCH /api/cards/[id]; this map is UX, not the rule.
 */
const NEXT_ACTIONS: Record<CardStatus, { label: string; status: CardStatus }[]> = {
  active: [
    { label: "Freeze", status: "frozen" },
    { label: "Cancel", status: "cancelled" },
  ],
  frozen: [
    { label: "Unfreeze", status: "active" },
    { label: "Cancel", status: "cancelled" },
  ],
  cancelled: [],
}

export function CardStatusActions({
  cardId,
  initialStatus,
  compact = false,
}: {
  cardId: string
  initialStatus: CardStatus
  /** Tighter buttons and no trailing explanatory text, for use in a table row. */
  compact?: boolean
}) {
  const [status, setStatus] = useState(initialStatus)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function transition(next: CardStatus) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not update the card.")
        return
      }
      setStatus(body.card.status)
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CardStatusBadge status={status} />
      {NEXT_ACTIONS[status].map((action) => (
        <Button
          key={action.status}
          variant="secondary"
          className={compact ? "px-2 py-1 text-xs" : "py-1.5"}
          disabled={pending}
          onClick={() => transition(action.status)}
        >
          {action.label}
        </Button>
      ))}
      {!compact && status === "cancelled" && (
        <span className="text-sm text-gray-500">Cancelled cards can&apos;t be reactivated.</span>
      )}
      {error && (
        <span
          role="alert"
          className={compact ? "text-xs text-red-600 dark:text-red-500" : "text-sm text-red-600 dark:text-red-500"}
        >
          {error}
        </span>
      )}
    </div>
  )
}
