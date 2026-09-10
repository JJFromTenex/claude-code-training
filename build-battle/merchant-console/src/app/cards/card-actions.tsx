"use client"

import { Button } from "@/components/Button"
import { Card } from "@/data/types"
import { canTransition } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

export function CardActions({
  card,
}: {
  card: Pick<Card, "id" | "status" | "nickname">
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const change = async (status: "active" | "frozen" | "cancelled") => {
    setError(null)
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? "The card could not be updated.")
        return
      }
      setConfirmingCancel(false)
      startTransition(() => {
        router.refresh()
      })
    } catch {
      setError("Could not reach the console. Try again.")
    }
  }

  const [busy, setBusy] = useState<"freeze" | "unfreeze" | "cancel" | null>(
    null,
  )

  const run = (
    action: "freeze" | "unfreeze" | "cancel",
    status: "active" | "frozen" | "cancelled",
  ) => {
    setBusy(action)
    void change(status).finally(() => setBusy(null))
  }

  if (card.status === "cancelled") {
    return <span className="text-sm text-gray-500">Cancelled</span>
  }

  if (confirmingCancel) {
    return (
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <span className="text-sm text-gray-500">
          Cancel {card.nickname}? This cannot be undone.
        </span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="px-2 py-1 text-xs"
            onClick={() => {
              setConfirmingCancel(false)
              setError(null)
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setConfirmingCancel(false)
            }}
            aria-label={`Keep ${card.nickname}`}
          >
            Keep card
          </Button>
          <Button
            variant="destructive"
            className="px-2 py-1 text-xs"
            isLoading={busy === "cancel"}
            onClick={() => run("cancel", "cancelled")}
            aria-label={`Confirm cancelling ${card.nickname}`}
          >
            Cancel card
          </Button>
        </div>
        {error && (
          <span
            role="alert"
            className="text-xs font-medium text-red-600 dark:text-red-500"
          >
            {error}
          </span>
        )}
      </div>
    )
  }

  const canFreeze = card.status === "active" && canTransition("active", "frozen")
  const canUnfreeze =
    card.status === "frozen" && canTransition("frozen", "active")
  const canCancel = canTransition(card.status, "cancelled")

  return (
    <div
      className="flex items-center gap-2"
      onKeyDown={(event) => {
        if (event.key === "Escape") setConfirmingCancel(false)
      }}
    >
      {canFreeze && (
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          isLoading={busy === "freeze" || isPending}
          onClick={() => run("freeze", "frozen")}
          aria-label={`Freeze ${card.nickname}`}
        >
          Freeze
        </Button>
      )}
      {canUnfreeze && (
        <Button
          variant="secondary"
          className="px-2 py-1 text-xs"
          isLoading={busy === "unfreeze" || isPending}
          onClick={() => run("unfreeze", "active")}
          aria-label={`Unfreeze ${card.nickname}`}
        >
          Unfreeze
        </Button>
      )}
      {canCancel && (
        <Button
          variant="ghost"
          className="px-2 py-1 text-xs text-red-600 dark:text-red-500"
          onClick={() => {
            setError(null)
            setConfirmingCancel(true)
          }}
          aria-label={`Cancel ${card.nickname}`}
        >
          Cancel
        </Button>
      )}
      {error && (
        <span
          role="alert"
          className="text-xs font-medium text-red-600 dark:text-red-500"
        >
          {error}
        </span>
      )}
    </div>
  )
}
