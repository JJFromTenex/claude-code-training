"use client"

import { Button } from "@/components/Button"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Cancel, behind a confirm.
 *
 * Cancelling is terminal, so one stray click should not do it. The server
 * refuses the transition afterwards regardless, but the reason this is two
 * steps is that ops cannot undo it.
 */
export function CancelCard({ id }: { id: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancel = async () => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "That change was refused.")
        return
      }
      setConfirming(false)
      router.refresh()
    } catch {
      setError("The console could not reach the server. Try again.")
    } finally {
      setPending(false)
    }
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <Button variant="secondary" className="w-fit py-1.5" onClick={() => setConfirming(true)}>
          Cancel card
        </Button>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-500">
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
      <div>
        <p className="text-sm font-medium text-red-800 dark:text-red-300">
          Cancel this card?
        </p>
        <p className="mt-1 text-sm text-red-700 dark:text-red-400">
          Cancelling is permanent. The card cannot be reactivated or unfrozen
          afterwards.
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          className="py-1.5"
          isLoading={pending}
          disabled={pending}
          onClick={cancel}
        >
          Yes, cancel it
        </Button>
        <Button
          variant="secondary"
          className="py-1.5"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Keep the card
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
