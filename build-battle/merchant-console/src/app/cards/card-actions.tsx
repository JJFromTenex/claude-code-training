"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

/** Freeze and unfreeze without a page reload. The server still decides. */
export function CardActions({
  cardId,
  nickname,
  status,
}: {
  cardId: string
  /** Named on every control, so a column of them is not eight "Freeze"s. */
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The button disables the element the user is standing on; put focus back.
  const statusRef = useRef<HTMLButtonElement>(null)
  const restoreTo = useRef(false)

  useEffect(() => {
    if (pending !== null) return
    if (restoreTo.current) statusRef.current?.focus()
    restoreTo.current = false
  }, [pending, status])

  async function move(to: CardStatus) {
    // Freeze/unfreeze swaps the same control; land back on it.
    restoreTo.current = true
    setPending(to)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.message ?? "That change could not be applied.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server. Retry in a moment.")
    } finally {
      setPending(null)
    }
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"
  const verb = status === "active" ? "Freeze" : "Unfreeze"

  if (status === "cancelled") {
    return (
      <span className="text-sm text-gray-500">
        No actions<span className="sr-only"> for {nickname}</span>
      </span>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        ref={statusRef}
        variant="secondary"
        className="py-1"
        aria-label={`${verb} ${nickname}`}
        isLoading={pending === next}
        onClick={() => move(next)}
      >
        {verb}
      </Button>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
