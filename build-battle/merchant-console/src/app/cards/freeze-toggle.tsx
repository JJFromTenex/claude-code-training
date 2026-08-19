"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze / unfreeze from the list without a full reload. The server decides
 * whether the transition is legal; this only asks and refreshes.
 */
export function FreezeToggle({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return <span className="text-xs text-gray-400">—</span>
  }

  const next: CardStatus = status === "active" ? "frozen" : "active"

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? "Could not change the card's status.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        className="py-1 text-xs"
        onClick={toggle}
        disabled={busy}
        aria-label={`${next === "frozen" ? "Freeze" : "Unfreeze"} card`}
      >
        {busy ? "…" : next === "frozen" ? "Freeze" : "Unfreeze"}
      </Button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  )
}
