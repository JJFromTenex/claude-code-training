"use client"

import { Button } from "@/components/Button"
import { CardAction } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useEffect, useReducer, useState } from "react"
import { cancelConfirmReducer } from "./cancel-confirm"

/**
 * Freeze, unfreeze, and cancel a card in place; the server owns the state machine.
 * Cancel takes two clicks, and the armed button disarms on Escape while focus is in
 * the row, on a successful cancel, after 5s, and on any blur leaving the row — a
 * sibling button keeps it armed. Those rules live in `cancel-confirm.ts`.
 */

const CONFIRM_TIMEOUT_MS = 5000

/** The transitions a row offers, in the order they read. */
const ACTIONS: { action: CardAction; label: string; variant: "secondary" | "ghost"; when: CardStatus[] }[] = [
  { action: "freeze", label: "Freeze", variant: "secondary", when: ["active"] },
  { action: "unfreeze", label: "Unfreeze", variant: "secondary", when: ["frozen"] },
  { action: "cancel", label: "Cancel", variant: "ghost", when: ["active", "frozen"] },
]

export function CardRowActions({ cardId, status }: { cardId: string; status: CardStatus }) {
  const router = useRouter()
  const [pending, setPending] = useState<CardAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, dispatchCancel] = useReducer(cancelConfirmReducer, false)

  // Cancelling is destructive, so the armed button disarms itself again.
  useEffect(() => {
    if (!confirmingCancel) return
    const timer = setTimeout(() => dispatchCancel({ type: "timeout" }), CONFIRM_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [confirmingCancel])

  const post = async (action: CardAction) => {
    setPending(action)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const payload = await response.json()
      if (!response.ok) return setError(payload.message ?? "That change could not be made.")
      dispatchCancel({ type: "succeeded" })
      router.refresh()
    } catch {
      setError("The console could not reach the server.")
    } finally {
      setPending(null)
    }
  }

  // A cancelled card is terminal: there is nothing left to offer.
  if (status === "cancelled") return <span className="text-sm text-gray-400 dark:text-gray-600">—</span>

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className="flex items-center justify-end gap-2"
        onBlur={(e) => dispatchCancel({ type: "blur", container: e.currentTarget, relatedTarget: e.relatedTarget })}
        onKeyDown={(e) => { if (e.key === "Escape") dispatchCancel({ type: "escape" }) }}
      >
        {ACTIONS.filter(({ when }) => when.includes(status)).map(({ action, label, variant }) => {
          const armed = action === "cancel" && confirmingCancel
          return (
            <Button
              key={action}
              variant={armed ? "destructive" : variant}
              className="py-1 text-xs"
              disabled={pending !== null}
              isLoading={pending === action}
              onClick={() => {
                if (action === "cancel" && !confirmingCancel) return dispatchCancel({ type: "arm" })
                post(action)
              }}
            >
              {armed ? "Confirm cancel" : label}
            </Button>
          )
        })}
      </div>
      {error && <p role="alert" className="text-right text-xs text-red-600 dark:text-red-500">{error}</p>}
    </div>
  )
}
