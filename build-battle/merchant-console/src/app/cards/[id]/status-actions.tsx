"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function StatusActions({ cardId, status }: { cardId: string; status: CardStatus }) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function transition(next: CardStatus) {
    setError(null)
    setLoading(next)
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.message ?? "Could not update status.")
      } else {
        router.refresh()
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(null)
    }
  }

  if (status === "cancelled") return null

  return (
    <div className="flex flex-wrap gap-2">
      {status === "active" && (
        <Button
          variant="secondary"
          isLoading={loading === "frozen"}
          loadingText="Freezing…"
          onClick={() => transition("frozen")}
        >
          Freeze card
        </Button>
      )}
      {status === "frozen" && (
        <Button
          variant="secondary"
          isLoading={loading === "active"}
          loadingText="Unfreezing…"
          onClick={() => transition("active")}
        >
          Unfreeze card
        </Button>
      )}
      <Button
        variant="destructive"
        isLoading={loading === "cancelled"}
        loadingText="Cancelling…"
        onClick={() => transition("cancelled")}
      >
        Cancel card
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
