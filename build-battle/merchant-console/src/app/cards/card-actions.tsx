"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze and unfreeze from the list without a full page reload: the POST
 * hits the status route (which enforces the state machine) and
 * router.refresh() re-renders the server component in place.
 */
export function CardActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function transition(next: CardStatus) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${cardId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        setError(data?.message ?? "Something went wrong.")
      } else {
        router.refresh()
      }
    } catch {
      setError("The request failed. Try again.")
    } finally {
      setPending(false)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">—</span>
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="py-1"
        disabled={pending}
        onClick={() => transition(status === "active" ? "frozen" : "active")}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
    </div>
  )
}
