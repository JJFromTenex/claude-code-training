"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface FreezeButtonProps {
  cardId: string
  status: CardStatus
}

export function FreezeButton({ cardId, status }: FreezeButtonProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return (
      <Button variant="ghost" disabled className="py-1 text-xs">
        Cancelled
      </Button>
    )
  }

  const target: CardStatus = status === "active" ? "frozen" : "active"
  const label = status === "active" ? "Freeze" : "Unfreeze"

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: target }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error ?? "Failed")
        setBusy(false)
        return
      }
      router.refresh()
      setBusy(false)
    } catch {
      setError("Network error")
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        onClick={submit}
        disabled={busy}
        className="py-1 text-xs"
      >
        {busy ? "..." : label}
      </Button>
      {error && (
        <span className="text-xs text-red-600 dark:text-red-500">{error}</span>
      )}
    </div>
  )
}
