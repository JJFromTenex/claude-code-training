"use client"

import { Button } from "@/components/Button"
import { CardAction } from "@/data/cards"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useEffect, useReducer, useState } from "react"
import { cancelConfirmReducer } from "./cancel-confirm"

/**
 * Freeze, unfreeze, and cancel a card in place. The server owns the state
 * machine; this only offers the transitions it will accept and re-reads the
 * row afterwards instead of reloading the page.
 *
 * Cancel takes two clicks. The armed button disarms on Escape while focus is
 * still in the row, on a successful cancel, after 5s, and whenever focus
 * leaves the row — including focus going nowhere, which is what a click on
 * blank space or the window losing focus looks like. It stays armed only when
 * focus moves to a sibling button in the same row. Those rules live in
 * `cancel-confirm.ts`.
 */

const CONFIRM_TIMEOUT_MS = 5000

export function CardRowActions({
  cardId,
  status,
}: {
  cardId: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState<CardAction | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, dispatchCancel] = useReducer(
    cancelConfirmReducer,
    false,
  )

  // Cancelling is destructive, so the armed button disarms itself again.
  useEffect(() => {
    if (!confirmingCancel) return
    const timer = setTimeout(
      () => dispatchCancel({ type: "timeout" }),
      CONFIRM_TIMEOUT_MS,
    )
    return () => clearTimeout(timer)
  }, [confirmingCancel])

  const run = async (action: CardAction) => {
    setPending(action)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${cardId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "That change could not be made.")
        return
      }
      dispatchCancel({ type: "succeeded" })
      router.refresh()
    } catch {
      setError("The console could not reach the server.")
    } finally {
      setPending(null)
    }
  }

  // A cancelled card is terminal: there is nothing left to offer.
  if (status === "cancelled") {
    return <span className="text-sm text-gray-400 dark:text-gray-600">—</span>
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div
        className="flex items-center justify-end gap-2"
        onBlur={(event) =>
          dispatchCancel({
            type: "blur",
            container: event.currentTarget,
            relatedTarget: event.relatedTarget,
          })
        }
        onKeyDown={(event) => {
          if (event.key === "Escape") dispatchCancel({ type: "escape" })
        }}
      >
        {status === "active" && (
          <Button
            variant="secondary"
            className="py-1 text-xs"
            disabled={pending !== null}
            isLoading={pending === "freeze"}
            onClick={() => run("freeze")}
          >
            Freeze
          </Button>
        )}
        {status === "frozen" && (
          <Button
            variant="secondary"
            className="py-1 text-xs"
            disabled={pending !== null}
            isLoading={pending === "unfreeze"}
            onClick={() => run("unfreeze")}
          >
            Unfreeze
          </Button>
        )}
        <Button
          variant={confirmingCancel ? "destructive" : "ghost"}
          className="py-1 text-xs"
          disabled={pending !== null}
          isLoading={pending === "cancel"}
          onClick={() => {
            if (!confirmingCancel) return dispatchCancel({ type: "arm" })
            run("cancel")
          }}
        >
          {confirmingCancel ? "Confirm cancel" : "Cancel"}
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="text-right text-xs text-red-600 dark:text-red-500"
        >
          {error}
        </p>
      )}
    </div>
  )
}
