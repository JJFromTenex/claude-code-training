"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and cancel from the list without a full page reload.
 *
 * The transition is guarded on the server; this only offers the moves that are
 * legal from the current status, and surfaces the server's refusal if the two
 * ever disagree.
 */
export function CardStatusActions({
  cardId,
  status,
  nickname,
}: {
  cardId: string
  status: CardStatus
  nickname: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">Cancelled</span>
  }

  async function change(next: CardStatus) {
    setError(null)
    setBusy(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        setError(payload?.message ?? "Could not update the card.")
        return
      }

      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  const working = busy || pending

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          className="py-1"
          disabled={working}
          onClick={() => change(status === "active" ? "frozen" : "active")}
        >
          {status === "active" ? "Freeze" : "Unfreeze"}
        </Button>
        <Button
          variant="ghost"
          className="py-1 text-red-600 dark:text-red-500"
          disabled={working}
          onClick={() => change("cancelled")}
          aria-label={`Cancel ${nickname}`}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
