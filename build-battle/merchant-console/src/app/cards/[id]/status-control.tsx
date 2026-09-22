"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

const NEXT: Partial<Record<CardStatus, { to: CardStatus; label: string; variant: "secondary" | "destructive" }[]>> = {
  active: [
    { to: "frozen", label: "Freeze", variant: "secondary" },
    { to: "cancelled", label: "Cancel card", variant: "destructive" },
  ],
  frozen: [
    { to: "active", label: "Unfreeze", variant: "secondary" },
    { to: "cancelled", label: "Cancel card", variant: "destructive" },
  ],
}

export function CardStatusControl({
  cardId,
  status,
  compact = false,
}: {
  cardId: string
  status: CardStatus
  /** List-row usage: freeze/unfreeze only, no cancel, smaller buttons. */
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allActions = NEXT[status] ?? []
  const actions = compact
    ? allActions.filter((action) => action.to !== "cancelled")
    : allActions
  if (actions.length === 0) return null

  const transition = async (to: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "flex flex-col items-end gap-2"}>
      <div className="flex gap-2">
        {actions.map((action) => (
          <Button
            key={action.to}
            variant={action.variant}
            disabled={pending}
            onClick={() => transition(action.to)}
            className={compact ? "px-2 py-1 text-xs" : undefined}
          >
            {action.label}
          </Button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
