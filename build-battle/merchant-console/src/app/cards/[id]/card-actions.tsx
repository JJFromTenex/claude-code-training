"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { Card, CardStatus } from "@/data/types"
import { formatDate } from "@/lib/dates"
import { useState } from "react"

/**
 * Owns everything that changes without a reload: status, freeze/unfreeze,
 * cancel-with-confirm, and the audit trail (it changes alongside status, so
 * it lives here to stay consistent after an action).
 */
export function CardActions({ card: initialCard }: { card: Card }) {
  const [card, setCard] = useState<Card>(initialCard)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  async function transition(status: CardStatus) {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Could not update this card.")
        return
      }
      setCard(data.card)
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  async function handleCancelConfirm() {
    await transition("cancelled")
    setCancelOpen(false)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={card.status} />
        {card.status !== "cancelled" ? (
          <>
            <Button
              variant="secondary"
              className="py-1.5"
              disabled={pending}
              isLoading={pending}
              onClick={() => transition(card.status === "active" ? "frozen" : "active")}
            >
              {card.status === "active" ? "Freeze" : "Unfreeze"}
            </Button>
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="py-1.5" disabled={pending}>
                  Cancel card
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel this card?</DialogTitle>
                  <DialogDescription>This cannot be undone.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Keep card</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    disabled={pending}
                    isLoading={pending}
                    onClick={handleCancelConfirm}
                  >
                    Cancel this card
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        ) : (
          <p className="text-sm text-gray-500">
            This card is cancelled and cannot be reactivated.
          </p>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <h2 className="mt-8 text-sm font-semibold text-gray-900 dark:text-gray-50">
        Audit trail
      </h2>
      <ol className="mt-4 space-y-4">
        {card.history.map((entry, index) => (
          <li key={index} className="flex gap-3">
            <span
              className="mt-1.5 size-2 shrink-0 rounded-full bg-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {entry.from === null ? "Issued" : `${entry.from} → ${entry.to}`}
              </p>
              <p className="text-sm text-gray-500">{formatDate(entry.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
