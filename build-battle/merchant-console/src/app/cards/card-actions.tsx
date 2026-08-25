"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { allowedTransitions } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze and unfreeze from the list, without a full page reload.
 *
 * The button set comes from the same state machine the server enforces, so
 * the UI cannot offer a transition the API will reject.
 */
export function CardActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const next = allowedTransitions(status)
  const canFreeze = next.includes("frozen")
  const canUnfreeze = next.includes("active")

  async function move(to: CardStatus) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.message ?? "That change did not stick.")
        return
      }
      // Re-render the server component in place: no full reload.
      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  if (!canFreeze && !canUnfreeze) {
    return <span className="text-sm text-gray-400">—</span>
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
      {canFreeze && (
        <Button
          variant="secondary"
          className="py-1"
          disabled={busy || pending}
          onClick={() => move("frozen")}
        >
          Freeze
        </Button>
      )}
      {canUnfreeze && (
        <Button
          variant="secondary"
          className="py-1"
          disabled={busy || pending}
          onClick={() => move("active")}
        >
          Unfreeze
        </Button>
      )}
    </div>
  )
}
