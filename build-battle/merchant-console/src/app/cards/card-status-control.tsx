"use client"

import { Button } from "@/components/Button"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { CardStatus } from "@/data/types"
import { useState } from "react"

/**
 * Freeze/unfreeze/cancel a card without a page reload. Status only ever
 * changes from the PATCH response, never optimistically, so a stale second
 * tab can't drift from what the server actually did.
 */
export function CardStatusControl({ id, status }: { id: string; status: CardStatus }) {
  const [current, setCurrent] = useState<CardStatus>(status)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const patch = async (next: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not update the card.")
        return
      }
      setCurrent(body.card.status)
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  const cancel = () => {
    if (window.confirm("Cancel this card? This can't be undone.")) {
      patch("cancelled")
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CardStatusBadge status={current} />
      {current !== "cancelled" && (
        <>
          {current === "active" ? (
            <Button
              variant="secondary"
              className="py-1 text-xs"
              disabled={pending}
              onClick={() => patch("frozen")}
            >
              Freeze
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="py-1 text-xs"
              disabled={pending}
              onClick={() => patch("active")}
            >
              Unfreeze
            </Button>
          )}
          <Button
            variant="destructive"
            className="py-1 text-xs"
            disabled={pending}
            onClick={cancel}
          >
            Cancel
          </Button>
        </>
      )}
      {error && <span className="text-xs text-red-600 dark:text-red-500">{error}</span>}
    </div>
  )
}
