"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { cx } from "@/lib/utils"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, or cancel a card in place. The server decides whether the
 * transition is legal; this only asks and then refreshes the server-rendered
 * page so the row updates without a full reload.
 */
export function CardActions({
  id,
  status,
  compact = false,
}: {
  id: string
  status: CardStatus
  compact?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") {
    return compact ? null : (
      <p className="text-sm text-gray-500">This card is cancelled and cannot be reactivated.</p>
    )
  }

  const move = async (to: CardStatus) => {
    if (pending) return
    if (to === "cancelled" && !window.confirm("Cancel this card? This cannot be undone.")) {
      return
    }
    setPending(to)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}/status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => null)
        setError(data?.message ?? "The card could not be updated.")
        return
      }
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(null)
    }
  }

  const buttonClass = compact ? "px-2 py-1 text-xs" : "py-1.5"

  return (
    <div className={cx("flex flex-col gap-1", compact ? "items-end" : "items-start")}>
      <div className="flex gap-2">
        {status === "active" ? (
          <Button
            variant="secondary"
            className={buttonClass}
            isLoading={pending === "frozen"}
            disabled={pending !== null}
            onClick={() => move("frozen")}
          >
            Freeze
          </Button>
        ) : (
          <Button
            variant="secondary"
            className={buttonClass}
            isLoading={pending === "active"}
            disabled={pending !== null}
            onClick={() => move("active")}
          >
            Unfreeze
          </Button>
        )}
        <Button
          variant={compact ? "ghost" : "destructive"}
          className={cx(buttonClass, compact && "text-red-600 dark:text-red-400")}
          isLoading={pending === "cancelled"}
          disabled={pending !== null}
          onClick={() => move("cancelled")}
        >
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
