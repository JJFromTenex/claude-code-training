"use client"

import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Status badge plus an inline freeze/unfreeze toggle, right in the list row.
 * PATCHes the status route and refreshes the server component in place — no full
 * page reload. The server enforces the state machine; this only offers the toggle.
 */
export function ListStatusCell({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function toggle() {
    const next: CardStatus = status === "active" ? "frozen" : "active"
    setBusy(true)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      if (res.ok) router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <CardStatusBadge status={status} />
      {status !== "cancelled" && (
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50 dark:text-blue-500"
        >
          {status === "active" ? "Freeze" : "Unfreeze"}
        </button>
      )}
    </div>
  )
}
