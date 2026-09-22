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
import { StatusBadge } from "@/components/ui/payments/StatusBadge"
import { Card, CardStatus, Merchant } from "@/data/types"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { useState } from "react"
import { IssueCardDialog } from "./issue-card-dialog"

export function CardsTable({
  initialCards,
  merchants,
}: {
  initialCards: Card[]
  merchants: Merchant[]
}) {
  const [cards, setCards] = useState<Card[]>(initialCards)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const merchantById = (id: string) => merchants.find((m) => m.id === id)

  function handleIssued(card: Card) {
    setCards((prev) => [card, ...prev])
  }

  async function toggleFreeze(card: Card) {
    const nextStatus: CardStatus = card.status === "active" ? "frozen" : "active"
    setPendingId(card.id)
    setRowErrors((prev) => ({ ...prev, [card.id]: "" }))
    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json()
      if (!response.ok) {
        setRowErrors((prev) => ({
          ...prev,
          [card.id]: data.error ?? "Could not update this card.",
        }))
        return
      }
      setCards((prev) => prev.map((c) => (c.id === data.card.id ? data.card : c)))
    } catch {
      setRowErrors((prev) => ({
        ...prev,
        [card.id]: "Could not reach the server. Try again.",
      }))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <>
      <div className="flex justify-end px-4 pb-4 sm:px-6">
        <IssueCardDialog merchants={merchants} onIssued={handleIssued} />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet.
                  </p>
                  <p className="mt-1 text-gray-500">
                    Click Issue card above to create the first virtual card for a
                    merchant.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => {
              const merchant = merchantById(card.merchantId)
              return (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link
                      href={`/cards/${card.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                      {card.nickname}
                    </Link>
                  </TableCell>
                  <TableCell>{merchant?.name}</TableCell>
                  <TableCell className="font-mono">•••• {card.last4}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-end gap-1">
                      {card.status !== "cancelled" && (
                        <Button
                          variant="secondary"
                          className="py-1 text-xs"
                          disabled={pendingId === card.id}
                          isLoading={pendingId === card.id}
                          onClick={() => toggleFreeze(card)}
                        >
                          {card.status === "active" ? "Freeze" : "Unfreeze"}
                        </Button>
                      )}
                      {rowErrors[card.id] && (
                        <p
                          className="text-xs text-red-600 dark:text-red-400"
                          role="alert"
                        >
                          {rowErrors[card.id]}
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>
    </>
  )
}
