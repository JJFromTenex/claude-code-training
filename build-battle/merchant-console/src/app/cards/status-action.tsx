"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Freeze/unfreeze from the list, without a full page reload. */
export function CardStatusAction({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") return null

  const next = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  const toggle = async () => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const body = await response.json()
        setError(body.message ?? "Could not update the card")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="px-2 py-1 text-xs"
        onClick={toggle}
        isLoading={pending}
      >
        {label}
      </Button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
    </div>
  )
}
