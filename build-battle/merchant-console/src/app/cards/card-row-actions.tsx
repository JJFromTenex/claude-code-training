"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Freeze, unfreeze, and cancel from the list.
 *
 * The status is refreshed from the server rather than guessed locally: the
 * store answers immediately, so `router.refresh()` is both simpler and honest
 * about who owns the status. The server refuses illegal transitions whatever
 * these buttons show.
 */
export function CardRowActions({
  id,
  status,
}: {
  id: string
  status: CardStatus
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingCancel, setConfirmingCancel] = useState(false)

  const change = async (next: CardStatus) => {
    setPending(true)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "That did not work. Try again.")
        return
      }
      setConfirmingCancel(false)
      router.refresh()
    } catch {
      setError("Could not reach the server.")
    } finally {
      setPending(false)
    }
  }

  // Cancelled is terminal, so there is nothing left to offer on the row.
  if (status === "cancelled") {
    return <span className="text-sm text-gray-500">—</span>
  }

  if (confirmingCancel) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="flex justify-end gap-2">
          <span className="self-center text-sm text-gray-500">
            Cancel for good?
          </span>
          <Button
            variant="destructive"
            className="py-1"
            disabled={pending}
            onClick={() => change("cancelled")}
          >
            {pending ? "Cancelling…" : "Yes, cancel"}
          </Button>
          <Button
            variant="secondary"
            className="py-1"
            disabled={pending}
            onClick={() => setConfirmingCancel(false)}
          >
            Keep
          </Button>
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex justify-end gap-2">
        <Button
          variant="secondary"
          className="py-1"
          disabled={pending}
          onClick={() => change(status === "active" ? "frozen" : "active")}
        >
          {status === "active" ? "Freeze" : "Unfreeze"}
        </Button>
        <Button
          variant="ghost"
          className="py-1 text-red-600 dark:text-red-500"
          disabled={pending}
          onClick={() => {
            setError(null)
            setConfirmingCancel(true)
          }}
        >
          Cancel
        </Button>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  )
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-sm text-red-600 dark:text-red-500">
      {children}
    </p>
  )
}
