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
import { listCards } from "@/data/cardQueries"
import { merchantById, merchants } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDialog } from "./issue-dialog"

export default async function CardsPage() {
  const cards = listCards()

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Cards
          </h1>
          <p className="text-sm text-gray-500">
            Virtual cards issued to merchants. Single-merchant, always virtual.
          </p>
        </div>
        <IssueCardDialog merchants={merchants} />
      </div>

      <TableRoot className="mt-6 border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Issued</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Issue one and it appears here. Cards live until the dev
                    server restarts — persistence is NWP-203.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell>
                  <Link
                    href={`/cards/${card.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                  >
                    {card.nickname}
                  </Link>
                </TableCell>
                <TableCell>{merchantById(card.merchantId)?.name}</TableCell>
                <TableCell className="font-mono text-gray-500">
                  {maskCardNumber(card.last4)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell>
                  <CardStatusBadge status={card.status} />
                </TableCell>
                <TableCell className="text-gray-500">
                  {formatDate(card.createdAt)}
                </TableCell>
                <TableCell className="text-right">
                  <CardActions card={card} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </div>
  )
}
