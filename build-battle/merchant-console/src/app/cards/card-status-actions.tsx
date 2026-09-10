"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze and unfreeze in place.
 *
 * `router.refresh()` re-renders the server component with the new status
 * rather than reloading the page. The server still guards the transition —
 * hiding a button is a convenience, never the enforcement.
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

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  const change = async () => {
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
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        className="py-1 text-xs"
        disabled={pending}
        onClick={change}
      >
        {pending ? "Saving…" : label}
      </Button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-500" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
