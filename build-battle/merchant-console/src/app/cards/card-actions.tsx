"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze and unfreeze from the list. The server owns the state machine — this
 * only asks, and shows what it says when the answer is no.
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"

  const change = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.message ?? "That change was refused.")
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        className="py-1"
        onClick={change}
        isLoading={busy || pending}
        loadingText={next === "frozen" ? "Freezing" : "Unfreezing"}
      >
        {next === "frozen" ? "Freeze" : "Unfreeze"}
      </Button>
    </div>
  )
}
