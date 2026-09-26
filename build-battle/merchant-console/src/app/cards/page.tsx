"use client"

import { Button } from "@/components/Button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { merchantById } from "@/data/merchants"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { useEffect, useState } from "react"
import Link from "next/link"
import { Card } from "@/data/types"
import { CardStatusBadge } from "@/components/cards/CardStatusBadge"
import { IssuanceForm } from "@/components/cards/IssuanceForm"

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const loadCards = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/cards")
      if (!response.ok) throw new Error("Failed to load cards")
      const data = await response.json()
      setCards(data)
      setError(null)
    } catch (err) {
      setError("Failed to load cards")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCards()
  }, [])

  const handleCardCreated = () => {
    setShowForm(false)
    loadCards()
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Button onClick={loadCards} className="mt-4">
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Virtual Cards</h1>
          <p className="text-gray-600">Issue and manage virtual cards for merchants</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="px-4 py-2">
          Issue Card
        </Button>
      </div>

      {showForm && (
        <IssuanceForm
          onSuccess={handleCardCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading cards...</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">No cards issued yet</p>
          <Button onClick={() => setShowForm(true)}>Issue your first card</Button>
        </div>
      ) : (
        <TableRoot>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Card Number</TableHeaderCell>
              <TableHeaderCell>Spend Limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Action</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.map((card) => {
              const merchant = merchantById(card.merchantId)
              return (
                <TableRow key={card.id}>
                  <TableCell className="font-medium">{card.nickname}</TableCell>
                  <TableCell>{merchant?.name || "Unknown"}</TableCell>
                  <TableCell className="font-mono">
                    •••• {card.last4}
                  </TableCell>
                  <TableCell>
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <CardStatusBadge status={card.status} />
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {formatDate(card.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Link href={`/cards/${card.id}`}>
                      <Button variant="secondary" className="text-sm px-3 py-1">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </TableRoot>
      )}
    </div>
  )
}
