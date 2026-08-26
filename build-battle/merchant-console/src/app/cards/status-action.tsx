"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/** Freeze or unfreeze a card from the list, without a full page reload. */
export function StatusAction({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-sm text-gray-400">—</span>
  }

  const nextStatus: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  const handleClick = async () => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "Couldn't update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Couldn't reach the server.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="light"
        className="py-1 text-xs"
        isLoading={pending}
        loadingText={label}
        onClick={handleClick}
      >
        {label}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}
    </div>
  )
}
