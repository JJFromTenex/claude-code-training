"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CardStatusToggle({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") return null

  const next: CardStatus = status === "active" ? "frozen" : "active"

  async function toggle() {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error ?? "Could not update the card.")
        return
      }
      router.refresh()
    } catch {
      setError("Something went wrong reaching the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={toggle} disabled={pending}>
        {status === "active" ? "Freeze card" : "Unfreeze card"}
      </Button>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>}
    </div>
  )
}
