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
import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskedNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDialog } from "./issue-dialog"

export default function CardsPage() {
  const cards = listCards()
  const live = cards.filter((card) => card.status !== "cancelled")

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {cards.length === 0
              ? "No cards issued yet."
              : `${live.length} live of ${cards.length}. Newest first.`}
          </p>
        </div>
        <IssueCardDialog
          merchants={merchants.map((m) => ({
            id: m.id,
            name: m.name,
            currency: m.currency,
          }))}
        />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell className="text-right">
                Spend limit
              </TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Issue one for a vendor subscription, ad spend, or a
                    contractor tool. It gets a limit from the moment it exists.
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
                  {maskedNumber(card.last4)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
                <TableCell>
                  <CardStatusBadge status={card.status} />
                </TableCell>
                <TableCell className="text-right">
                  <CardActions
                    cardId={card.id}
                    nickname={card.nickname}
                    status={card.status}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
