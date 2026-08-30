"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CardRowActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function patchStatus(next: CardStatus) {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? "Could not update the card")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("Could not reach the server")
    } finally {
      setPending(false)
    }
  }

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  if (confirming) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-gray-500">
            Cancel this card? This cannot be undone.
          </span>
          <Button
            variant="destructive"
            className="px-2 py-1 text-xs"
            onClick={() => patchStatus("cancelled")}
            disabled={pending}
            isLoading={pending}
          >
            Confirm
          </Button>
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => setConfirming(false)}
            disabled={pending}
          >
            Back
          </Button>
        </div>
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">
            {error}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          onClick={() => patchStatus(status === "active" ? "frozen" : "active")}
          disabled={pending}
          isLoading={pending}
        >
          {status === "active" ? "Freeze" : "Unfreeze"}
        </Button>
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          onClick={() => setConfirming(true)}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  )
}
