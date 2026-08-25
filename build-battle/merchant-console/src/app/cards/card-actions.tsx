"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Freeze / unfreeze / cancel from a row. The buttons offer legal moves; the PATCH handler enforces them. */
export function CardActions({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">No actions</span>
  }

  const move = async (to: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(body.error ?? "That change was not applied.")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-sm text-gray-700 dark:text-gray-300">Cancel for good?</span>
            <Button variant="secondary" className="py-1" onClick={() => setConfirming(false)} disabled={pending}>
              Keep
            </Button>
            <Button variant="destructive" className="py-1" onClick={() => move("cancelled")} isLoading={pending}>
              Cancel card
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              className="py-1"
              onClick={() => move(status === "active" ? "frozen" : "active")}
              isLoading={pending}
            >
              {status === "active" ? "Freeze" : "Unfreeze"}
            </Button>
            <Button variant="ghost" className="py-1 text-red-600 dark:text-red-500" onClick={() => setConfirming(true)} disabled={pending}>
              Cancel
            </Button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
