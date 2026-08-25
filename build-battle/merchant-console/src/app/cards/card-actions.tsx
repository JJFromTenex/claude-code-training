"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { allowedTransitions } from "@/lib/cards"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/**
 * Freeze and unfreeze without a full page reload.
 *
 * The button set comes from the same state machine the server enforces, so
 * the UI cannot offer a transition the API will reject.
 *
 * Accessibility: a table of eight buttons all labelled "Freeze" tells a
 * screen-reader user nothing about which card they are on, so each button
 * names its card. The outcome goes into a live region, because a badge
 * changing colour elsewhere in the row is a silent event.
 */
export function CardActions({
  cardId,
  cardNickname,
  status,
}: {
  cardId: string
  cardNickname: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")

  const next = allowedTransitions(status)
  const canFreeze = next.includes("frozen")
  const canUnfreeze = next.includes("active")
  const disabled = busy || pending

  async function move(to: CardStatus) {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message = payload.message ?? "That change did not stick."
        setError(message)
        setAnnouncement(message)
        return
      }
      setAnnouncement(
        to === "frozen"
          ? `${cardNickname} is now frozen.`
          : `${cardNickname} is active again.`,
      )
      // Re-render the server component in place: no full reload.
      startTransition(() => router.refresh())
    } catch {
      const message = "Could not reach the server."
      setError(message)
      setAnnouncement(message)
    } finally {
      setBusy(false)
    }
  }

  if (!canFreeze && !canUnfreeze) {
    return (
      <span className="text-sm text-gray-400" aria-label="No actions available">
        —
      </span>
    )
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {/* Announced to screen readers; the visible cue is the badge changing. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>

      {error && (
        <span role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </span>
      )}

      {canFreeze && (
        <Button
          variant="secondary"
          className="py-1"
          disabled={disabled}
          onClick={() => move("frozen")}
          aria-label={`Freeze ${cardNickname}`}
        >
          Freeze
        </Button>
      )}
      {canUnfreeze && (
        <Button
          variant="secondary"
          className="py-1"
          disabled={disabled}
          onClick={() => move("active")}
          aria-label={`Unfreeze ${cardNickname}`}
        >
          Unfreeze
        </Button>
      )}
    </div>
  )
}
