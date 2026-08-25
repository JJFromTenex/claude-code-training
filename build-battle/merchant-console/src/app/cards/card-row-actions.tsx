"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { MouseEvent, useState } from "react"

/**
 * Freeze/unfreeze toggle for a card row. The server is the enforcement —
 * this only offers the action the current status allows and reflects
 * whatever it says back (including a 409 on an illegal transition).
 */
export function CardRowActions({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-gray-400 dark:text-gray-600">—</span>
  }

  const action = status === "active" ? "freeze" : "unfreeze"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  const handleClick = async (event: MouseEvent) => {
    // The row's nickname cell is a separate link, but stop propagation
    // defensively so this action can never trigger a navigation.
    event.preventDefault()
    event.stopPropagation()
    if (pending) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.message ?? `Could not ${action} the card.`)
        setPending(false)
        return
      }

      router.refresh()
      setPending(false)
    } catch {
      setError("Could not reach the server.")
      setPending(false)
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        variant="secondary"
        className="px-2 py-1 text-xs"
        disabled={pending}
        onClick={handleClick}
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
    </span>
  )
}
