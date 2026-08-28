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
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { Card, CardStatus } from "@/data/types"
import { maskedNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface Row extends Card {
  merchantName: string
}

/**
 * The card list.
 *
 * Freeze and unfreeze happen here without a page load: the PATCH returns the
 * updated card and the row renders what came back, so the table never shows a
 * status the server did not agree to.
 */
export function CardsTable({ cards }: { cards: Row[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(cards)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const setStatus = async (id: string, status: CardStatus) => {
    setPending(id)
    setError(null)
    try {
      const response = await fetch(`/api/cards/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "That change was refused.")
        return
      }
      setRows((current) =>
        current.map((row) =>
          row.id === id ? { ...row, ...body.card, merchantName: row.merchantName } : row,
        ),
      )
      router.refresh()
    } catch {
      setError("The console could not reach the server. Try again.")
    } finally {
      setPending(null)
    }
  }

  return (
    <>
      {error && (
        <p
          role="alert"
          className="mx-4 mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 sm:mx-6 dark:bg-red-950 dark:text-red-400"
        >
          {error}
        </p>
      )}
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
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((card) => (
              <TableRow key={card.id}>
                <TableCell>
                  <Link
                    href={`/cards/${card.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                  >
                    {card.nickname}
                  </Link>
                </TableCell>
                <TableCell>{card.merchantName}</TableCell>
                <TableCell className="font-mono tabular-nums">
                  {maskedNumber(card.last4)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell>
                  <CardStatusBadge status={card.status} />
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
                <TableCell className="text-right">
                  {card.status === "cancelled" ? (
                    <span className="text-sm text-gray-500">No actions</span>
                  ) : (
                    <Button
                      variant="secondary"
                      className="py-1"
                      disabled={pending === card.id}
                      onClick={() =>
                        setStatus(
                          card.id,
                          card.status === "active" ? "frozen" : "active",
                        )
                      }
                    >
                      {card.status === "active" ? "Freeze" : "Unfreeze"}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </>
  )
}
