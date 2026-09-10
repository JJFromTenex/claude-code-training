"use client"

import { Button } from "@/components/Button"
import type { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze and unfreeze from the list. The server decides whether the
 * transition is legal; this only asks.
 */
export function CardStatusActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"

  const toggle = async () => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        setError(payload.message ?? "That did not work.")
        return
      }
      // Re-render the server component in place: no full page reload.
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
        onClick={toggle}
        isLoading={pending}
        loadingText={next === "frozen" ? "Freezing" : "Unfreezing"}
      >
        {next === "frozen" ? "Freeze" : "Unfreeze"}
      </Button>
    </div>
  )
}
