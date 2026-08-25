"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

export function CardRowActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  if (status === "cancelled") return null

  async function toggle() {
    setLoading(true)
    const to = status === "active" ? "frozen" : "active"
    try {
      const res = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (res.ok) router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="ghost"
      className="py-1"
      disabled={loading}
      onClick={toggle}
    >
      {status === "active" ? "Freeze" : "Unfreeze"}
    </Button>
  )
}
