"use client"

import { Button } from "@/components/Button"
import { merchantById } from "@/data/merchants"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/data/types"
import { CardStatusBadge } from "@/components/cards/CardStatusBadge"
import { useParams } from "next/navigation"

export default function CardDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [card, setCard] = useState<Card | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    const loadCard = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/cards/${id}`)
        if (!response.ok) throw new Error("Card not found")
        const data = await response.json()
        setCard(data)
        setError(null)
      } catch (err) {
        setError("Failed to load card")
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      loadCard()
    }
  }, [id])

  const handleStatusChange = async (newStatus: string) => {
    if (!card) return

    try {
      setUpdating(true)
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to update card")
      }

      const updatedCard = await response.json()
      setCard(updatedCard)
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setUpdating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Loading card details...</p>
      </div>
    )
  }

  if (error || !card) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Card not found"}</p>
          <Link href="/cards">
            <Button>Back to Cards</Button>
          </Link>
        </div>
      </div>
    )
  }

  const merchant = merchantById(card.merchantId)

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/cards">
          <Button variant="secondary">← Back</Button>
        </Link>
        <h1 className="text-3xl font-bold">{card.nickname}</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Card Details</h2>

          <div className="space-y-4">
            <div>
              <p className="text-gray-600">Card Number</p>
              <p className="font-mono text-lg">•••• {card.last4}</p>
            </div>

            <div>
              <p className="text-gray-600">Merchant</p>
              <p className="font-medium">{merchant?.name || "Unknown"}</p>
            </div>

            <div>
              <p className="text-gray-600">Spend Limit</p>
              <p className="font-medium">
                {formatMoney(card.limit, card.currency)}
              </p>
            </div>

            <div>
              <p className="text-gray-600">Status</p>
              <div className="mt-2">
                <CardStatusBadge status={card.status} />
              </div>
            </div>

            <div>
              <p className="text-gray-600">Created</p>
              <p className="font-medium">{formatDate(card.createdAt)}</p>
            </div>
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-6 dark:border-gray-800">
          <h2 className="text-lg font-semibold mb-4">Card Actions</h2>

          <div className="space-y-3">
            {card.status === "active" && (
              <Button
                onClick={() => handleStatusChange("frozen")}
                disabled={updating}
                variant="secondary"
                className="w-full"
              >
                {updating ? "Updating..." : "Freeze Card"}
              </Button>
            )}

            {card.status === "frozen" && (
              <>
                <Button
                  onClick={() => handleStatusChange("active")}
                  disabled={updating}
                  className="w-full"
                >
                  {updating ? "Updating..." : "Unfreeze Card"}
                </Button>
                <Button
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={updating}
                  variant="secondary"
                  className="w-full"
                >
                  {updating ? "Updating..." : "Cancel Card"}
                </Button>
              </>
            )}

            {card.status === "active" && (
              <Button
                onClick={() => handleStatusChange("cancelled")}
                disabled={updating}
                variant="secondary"
                className="w-full"
              >
                {updating ? "Updating..." : "Cancel Card"}
              </Button>
            )}

            {card.status === "cancelled" && (
              <div className="text-gray-600 p-3 bg-gray-100 rounded dark:bg-gray-900">
                This card is cancelled and cannot be modified.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-6 dark:border-gray-800">
        <h2 className="text-lg font-semibold mb-4">Spend Activity</h2>
        <div className="text-gray-600">
          <p>Spend tracking will be available in a future update.</p>
          <p className="text-sm mt-2">Currently showing: $0.00 of {formatMoney(card.limit, card.currency)}</p>
        </div>
      </div>
    </div>
  )
}
