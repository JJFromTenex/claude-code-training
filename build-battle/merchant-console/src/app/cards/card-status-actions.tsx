"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import * as React from "react"

/**
 * Freeze, unfreeze, and cancel. The server owns the state machine; this only
 * offers the transitions that are legal from here, and re-renders in place
 * rather than reloading the page.
 */
export function CardStatusActions({
  cardId,
  status,
  size = "default",
}: {
  cardId: string
  status: CardStatus
  size?: "default" | "compact"
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState<CardStatus | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  // Cancelling is terminal — nothing comes back from it — so it asks first.
  // Freezing is reversible and does not.
  const [confirmingCancel, setConfirmingCancel] = React.useState(false)

  async function transition(to: CardStatus) {
    setPending(to)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  if (status === "cancelled") {
    return (
      <span className="text-xs text-gray-500">Cancelled — no actions</span>
    )
  }

  const buttonClass = size === "compact" ? "py-1 text-xs" : "py-1.5"

  if (confirmingCancel) {
    return (
      <div className="flex items-center justify-end gap-2">
        <span className="text-xs text-gray-600 dark:text-gray-400">
          Cancel permanently?
        </span>
        <Button
          variant="destructive"
          className={buttonClass}
          disabled={pending !== null}
          isLoading={pending === "cancelled"}
          onClick={() => transition("cancelled")}
        >
          Yes, cancel
        </Button>
        <Button
          variant="secondary"
          className={buttonClass}
          disabled={pending !== null}
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
        className={buttonClass}
        disabled={pending !== null}
        isLoading={pending === (status === "active" ? "frozen" : "active")}
        onClick={() => transition(status === "active" ? "frozen" : "active")}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>
      <Button
        variant="ghost"
        className={buttonClass}
        disabled={pending !== null}
        onClick={() => setConfirmingCancel(true)}
      >
        Cancel
      </Button>
    </div>
  )
}
