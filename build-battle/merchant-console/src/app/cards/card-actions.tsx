"use client"

import { Button } from "@/components/Button"
import { CardStatus } from "@/data/types"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

/** Freeze / unfreeze from the list row without a full page load. */
export function CardActions({ id, status }: { id: string; status: CardStatus }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === "cancelled") return null

  const action = status === "active" ? "freeze" : "unfreeze"

  async function apply() {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Something went wrong.")
        return
      }
      startTransition(() => router.refresh())
    } catch {
      setError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      {error && (
        <span role="alert" className="text-sm text-red-600 dark:text-red-500">
          {error}
        </span>
      )}
      <Button
        variant="secondary"
        className="py-1"
        isLoading={submitting || isPending}
        onClick={apply}
      >
        {status === "active" ? "Freeze" : "Unfreeze"}
      </Button>
    </div>
  )
}
