"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze / unfreeze / cancel a card. PATCHes the status route and refreshes the
 * server component in place — no full page reload. The server enforces the
 * state machine; these buttons only offer the legal moves for the current state.
 */
export function CardStatusControls({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function change(next: CardStatus) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        This card is cancelled. No further changes are possible.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" && (
        <Button variant="secondary" disabled={busy} onClick={() => change("frozen")}>
          Freeze
        </Button>
      )}
      {status === "frozen" && (
        <Button variant="secondary" disabled={busy} onClick={() => change("active")}>
          Unfreeze
        </Button>
      )}
      <Button variant="secondary" disabled={busy} onClick={() => change("cancelled")}>
        Cancel card
      </Button>
      {error && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  )
}
