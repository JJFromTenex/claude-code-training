"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze / unfreeze / cancel a card in place. Every transition is enforced
 * server-side; this only offers the moves the state machine allows and
 * re-renders the server component on success — no full page reload. Cancel is
 * terminal, so it asks for confirmation first.
 */
export function CardActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const move = async (to: CardStatus) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.message ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
      setConfirmingCancel(false)
    }
  }

  if (confirmingCancel) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-gray-500">Cancel this card?</span>
        <Button
          variant="destructive"
          className="py-1"
          isLoading={busy}
          disabled={busy}
          onClick={() => move("cancelled")}
        >
          Confirm
        </Button>
        <Button
          variant="ghost"
          className="py-1"
          disabled={busy}
          onClick={() => setConfirmingCancel(false)}
        >
          Keep
        </Button>
      </div>
    )
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
        isLoading={busy}
        disabled={busy}
        onClick={() => move(status === "active" ? "frozen" : "active")}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>
      <Button
        variant="ghost"
        className="py-1 text-red-600 dark:text-red-500"
        disabled={busy}
        onClick={() => setConfirmingCancel(true)}
      >
        Cancel
      </Button>
    </div>
  )
}
