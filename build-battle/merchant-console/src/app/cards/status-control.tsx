"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freezes, unfreezes, or cancels a card without a full page reload.
 * `router.refresh()` re-runs the server components for this route on the
 * existing page, so the list or detail view picks up the new status
 * without a browser navigation.
 */
export function StatusControl({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setStatus = async (next: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">Cancelled</span>
  }

  return (
    <div className="flex items-center gap-2">
      {status === "active" ? (
        <Button
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() => setStatus("frozen")}
        >
          Freeze
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() => setStatus("active")}
        >
          Unfreeze
        </Button>
      )}
      <Button
        variant="ghost"
        className="py-1 text-red-600 hover:bg-red-50 dark:text-red-500 dark:hover:bg-red-950/40"
        disabled={pending}
        onClick={() => setStatus("cancelled")}
      >
        Cancel
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
    </div>
  )
}
