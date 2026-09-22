"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function StatusActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [current, setCurrent] = useState(status)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setStatus = async (next: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not update the card.")
        return
      }
      setCurrent(data.status)
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  if (current === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        This card is cancelled and cannot be reactivated.
      </p>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {current === "active" ? (
        <Button
          variant="secondary"
          onClick={() => setStatus("frozen")}
          disabled={pending}
        >
          Freeze
        </Button>
      ) : (
        <Button
          variant="secondary"
          onClick={() => setStatus("active")}
          disabled={pending}
        >
          Unfreeze
        </Button>
      )}
      <Button
        variant="destructive"
        onClick={() => setStatus("cancelled")}
        disabled={pending}
      >
        Cancel
      </Button>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
      )}
    </div>
  )
}
