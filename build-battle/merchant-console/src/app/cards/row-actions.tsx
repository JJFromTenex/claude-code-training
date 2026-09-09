"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useEffect, useReducer, useState } from "react"
import { cancelConfirm, idle } from "./cancel-confirm"

/**
 * Freeze, unfreeze and cancel. router.refresh() re-fetches this route's data
 * in place rather than reloading the page. Cancel takes two clicks.
 */
export function CardRowActions({
  id,
  nickname,
  status,
}: {
  id: string
  nickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [confirm, dispatch] = useReducer(cancelConfirm, idle)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!confirm.armed) return
    const timer = setTimeout(() => dispatch({ type: "timeout" }), 5000)
    return () => clearTimeout(timer)
  }, [confirm.armed])

  // Cancelled is terminal on the server and terminal here: nothing to offer.
  if (status === "cancelled") {
    return <span className="text-gray-500">&mdash;</span>
  }

  const send = async (action: "freeze" | "unfreeze" | "cancel") => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.message ?? "That change was refused.")
        return
      }
      router.refresh()
    } catch {
      setError("The console could not reach the server. Nothing changed.")
    } finally {
      setBusy(false)
      dispatch({ type: "settled" })
    }
  }

  const freezing = status === "active"

  return (
    <div
      data-card-actions
      className="flex items-center justify-end gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") dispatch({ type: "escape" })
      }}
    >
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      )}
      <Button
        variant="secondary"
        className="px-2 py-1 text-xs"
        disabled={busy}
        aria-label={`${freezing ? "Freeze" : "Unfreeze"} ${nickname}`}
        onClick={() => send(freezing ? "freeze" : "unfreeze")}
      >
        {freezing ? "Freeze" : "Unfreeze"}
      </Button>
      <Button
        variant={confirm.armed ? "destructive" : "secondary"}
        className="px-2 py-1 text-xs"
        disabled={busy}
        aria-label={
          confirm.armed
            ? `Confirm cancelling ${nickname}. This cannot be undone.`
            : `Cancel ${nickname}`
        }
        onClick={() =>
          confirm.armed ? send("cancel") : dispatch({ type: "arm" })
        }
        onBlur={(event) => {
          const row = event.currentTarget.closest("[data-card-actions]")
          const next = event.relatedTarget as Node | null
          dispatch({
            type: "blur",
            toRow: Boolean(next && row?.contains(next)),
          })
        }}
      >
        {confirm.armed ? "Confirm cancel" : "Cancel"}
      </Button>
    </div>
  )
}
