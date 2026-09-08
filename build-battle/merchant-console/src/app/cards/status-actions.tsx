"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze / unfreeze / cancel a card, without a full page reload.
 * router.refresh() re-runs the server component and re-fetches list/detail.
 */
export function CardStatusActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const transitionTo = (next: CardStatus) => {
    setError(null)
    startTransition(async () => {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.message ?? "Could not update card")
        return
      }
      router.refresh()
    })
  }

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        Cancelled cards are terminal — no further status changes.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "active" ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => transitionTo("frozen")}
        >
          {pending ? "Freezing..." : "Freeze"}
        </Button>
      ) : (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => transitionTo("active")}
        >
          {pending ? "Unfreezing..." : "Unfreeze"}
        </Button>
      )}
      <Button
        variant="destructive"
        disabled={pending}
        onClick={() => transitionTo("cancelled")}
      >
        Cancel card
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
