"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze and unfreeze from the list.
 *
 * Posts the transition and refreshes the server component rather than
 * reloading, so the row updates in place. The server owns the state machine —
 * hiding the button on a cancelled card is a courtesy, not the guard.
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
  const [failed, setFailed] = useState(false)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"

  const move = async () => {
    setPending(true)
    setFailed(false)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        setFailed(true)
        return
      }
      router.refresh()
    } catch {
      setFailed(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {failed && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-500">
          Did not save
        </span>
      )}
      <Button
        variant="secondary"
        className="py-1"
        isLoading={pending}
        onClick={move}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>
    </div>
  )
}
