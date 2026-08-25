"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import * as React from "react"

/**
 * Freeze and unfreeze from the list without a full page reload.
 *
 * The server owns the state machine; this only offers the moves that are
 * legal from where the card is now, and shows what the server says when it
 * refuses one anyway.
 */
export function CardStatusActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Nothing comes back from cancelled, so offer nothing.
  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  async function move() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const body = await response.json()
        setError(body.message ?? "That did not work.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        className="py-1"
        onClick={move}
        isLoading={pending}
      >
        {label}
      </Button>
    </div>
  )
}
