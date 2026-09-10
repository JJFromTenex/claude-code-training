"use client"

import { Button } from "@/components/Button"
import { canTransition } from "@/data/cardRules"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"

/**
 * Freeze, unfreeze, and (where allowed) cancel. The buttons mirror the state
 * machine; the PATCH route is what enforces it. After a change the server
 * components re-render in place via router.refresh(), with no full reload.
 */
export function CardStatusActions({
  cardId,
  nickname,
  status,
  allowCancel = false,
}: {
  cardId: string
  nickname: string
  status: CardStatus
  allowCancel?: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [refreshing, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const busy = saving || refreshing

  useEffect(() => {
    if (confirming) confirmRef.current?.focus()
  }, [confirming])

  const change = async (to: CardStatus) => {
    setError(null)
    setSaving(true)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        setError(body?.error?.message ?? "The card could not be updated.")
        return
      }
      setConfirming(false)
      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server. The card was not changed.")
    } finally {
      setSaving(false)
    }
  }

  if (status === "cancelled") {
    return (
      <p className="text-sm text-gray-500">
        {allowCancel ? "Cancelled cards cannot be reactivated." : "—"}
      </p>
    )
  }

  const toggleTo: CardStatus = status === "frozen" ? "active" : "frozen"

  return (
    <div className="flex flex-col items-start gap-2">
      {confirming ? (
        <div
          role="group"
          aria-label={`Confirm cancelling ${nickname}`}
          className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-400/10"
        >
          <p className="text-sm text-red-900 dark:text-red-400">
            Cancel {nickname}? This cannot be undone, and the card stops working
            immediately.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              ref={confirmRef}
              variant="destructive"
              className="py-1.5"
              isLoading={busy}
              loadingText="Cancelling…"
              onClick={() => change("cancelled")}
            >
              Yes, cancel card
            </Button>
            <Button
              variant="secondary"
              className="py-1.5"
              disabled={busy}
              onClick={() => {
                setConfirming(false)
                requestAnimationFrame(() => cancelRef.current?.focus())
              }}
            >
              Keep card
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          {canTransition(status, toggleTo) && (
            <Button
              variant="secondary"
              className="py-1.5"
              isLoading={busy}
              loadingText={toggleTo === "frozen" ? "Freezing…" : "Unfreezing…"}
              aria-label={`${toggleTo === "frozen" ? "Freeze" : "Unfreeze"} ${nickname}`}
              onClick={() => change(toggleTo)}
            >
              {toggleTo === "frozen" ? "Freeze" : "Unfreeze"}
            </Button>
          )}
          {allowCancel && canTransition(status, "cancelled") && (
            <Button
              ref={cancelRef}
              variant="ghost"
              className="py-1.5 text-red-600 dark:text-red-400"
              disabled={busy}
              onClick={() => setConfirming(true)}
            >
              Cancel card
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
