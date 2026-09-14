"use client"

import { Button } from "@/components/Button"
import { Card, CardStatus } from "@/data/types"
import { CARD_TRANSITIONS } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState } from "react"

const LABELS: Record<CardStatus, string> = { active: "Unfreeze", frozen: "Freeze", cancelled: "Cancel card" }

/**
 * Freeze, unfreeze, or cancel without a full page reload: PATCH, then refresh
 * the server tree in place. Only moves the server's state machine accepts are offered.
 */
export function CardActions({ card, compact = false }: { card: Card; compact?: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const moves = CARD_TRANSITIONS[card.status]
  if (moves.length === 0) return <span className="text-sm text-gray-500">No actions — cancelled cards are final.</span>

  async function move(to: CardStatus) {
    if (to === "cancelled" && !window.confirm(`Cancel "${card.nickname}"? This cannot be undone.`)) return
    setPending(to)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!res.ok) {
        const data: { error?: string } = await res.json().catch(() => ({}))
        return setError(data.error ?? "That change did not go through. Try again.")
      }
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        {moves.map((to) => (
          <Button
            key={to}
            variant={to === "cancelled" ? "destructive" : "secondary"}
            className={compact ? "px-2 py-1 text-xs" : "py-1.5"}
            isLoading={pending === to}
            loadingText={LABELS[to]}
            disabled={pending !== null}
            onClick={() => move(to)}
            aria-label={`${LABELS[to]} ${card.nickname}`}
          >
            {LABELS[to]}
          </Button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
