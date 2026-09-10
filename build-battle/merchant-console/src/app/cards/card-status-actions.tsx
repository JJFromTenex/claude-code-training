"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and cancel.
 *
 * `router.refresh()` re-renders the server component with the new status
 * rather than reloading the page. The server still guards every transition —
 * hiding a button is a convenience, never the enforcement.
 *
 * Cancel asks first, because cancelled is terminal and there is no undo.
 */
export function CardStatusActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const change = async (next: CardStatus) => {
    setError(null)
    const response = await fetch(`/api/cards/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: next }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.message ?? "Could not change the card status.")
      return
    }
    setConfirming(false)
    startTransition(() => router.refresh())
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <p
          id={`cancel-warning-${id}`}
          className="text-xs text-gray-600 dark:text-gray-400"
        >
          Cancel permanently? This cannot be undone.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="py-1 text-xs"
            onClick={() => setConfirming(false)}
          >
            Keep card
          </Button>
          <Button
            variant="destructive"
            className="py-1 text-xs"
            disabled={pending}
            aria-describedby={`cancel-warning-${id}`}
            onClick={() => change("cancelled")}
          >
            {pending ? "Cancelling…" : "Yes, cancel"}
          </Button>
        </div>
        {error && (
          <p className="text-xs text-red-600 dark:text-red-500" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="py-1 text-xs"
          disabled={pending}
          onClick={() => change(next)}
        >
          {pending ? "Saving…" : label}
        </Button>
        <Button
          variant="ghost"
          className="py-1 text-xs text-red-600 dark:text-red-500"
          onClick={() => setConfirming(true)}
        >
          Cancel card
        </Button>
      </div>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
