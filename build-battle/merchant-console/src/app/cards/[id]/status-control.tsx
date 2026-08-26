"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CardStatusControl({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(status)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const transition = async (next: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.error ?? "Could not update the card.")
        return
      }
      setCurrent(body.card.status)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  if (current === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        Cancelled — this card cannot be reactivated.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {current === "active" ? (
        <Button
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() => transition("frozen")}
        >
          Freeze
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() => transition("active")}
        >
          Unfreeze
        </Button>
      )}
      <Button
        variant="destructive"
        className="py-1"
        disabled={pending}
        onClick={() => transition("cancelled")}
      >
        Cancel
      </Button>
      {error && (
        <p role="alert" className="w-full text-sm text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
