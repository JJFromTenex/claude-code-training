"use client"

import { Button } from "@/components/Button"
import { Snowflake } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface FreezeButtonProps {
  cardId: string
  status: string
}

export function FreezeButton({ cardId, status }: FreezeButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleToggleFreeze = async () => {
    setLoading(true)
    try {
      const action = status === "active" ? "freeze" : "unfreeze"
      const response = await fetch(`/api/cards/${cardId}/freeze`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (response.ok) {
        router.refresh()
      } else {
        const error = await response.json()
        console.error(error.error)
      }
    } catch (err) {
      console.error("Failed to toggle freeze")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleToggleFreeze}
      disabled={loading}
      className="gap-2"
    >
      <Snowflake className="size-4" />
      {status === "active" ? "Freeze" : "Unfreeze"}
    </Button>
  )
}
