"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/Button"
import type { Card, CardStatus } from "@/data/types"

function nextStatusFor(status: CardStatus): CardStatus | null {
  if (status === "active") return "frozen"
  if (status === "frozen") return "active"
  return null
}

export function CardActions({ card }: { card: Card }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nextStatus = nextStatusFor(card.status)

  // A cancelled card is terminal: no transition control is rendered for it.
  if (nextStatus === null) {
    return null
  }

  const label = nextStatus === "frozen" ? "Freeze card" : "Unfreeze card"

  const handleClick = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch(`/api/cards/${card.id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })

      if (!response.ok) {
        const body = (await response.json()) as { message: string }
        setError(body.message)
        setSubmitting(false)
        return
      }

      setSubmitting(false)
      router.refresh()
    } catch {
      setError("Something went wrong updating the card. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={handleClick}
        disabled={submitting}
        isLoading={submitting}
        loadingText={label}
      >
        {label}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
