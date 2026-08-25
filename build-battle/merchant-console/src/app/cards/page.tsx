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
import { merchantById, merchants } from "@/data/merchants"
import { store } from "@/data/store"
import { formatDate } from "@/lib/dates"
import { maskedNumber } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { IssueCardDialog } from "./issue-card-dialog"
import { StatusControl } from "./status-control"

export default function CardsPage() {
  const cards = [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {cards.length} card{cards.length === 1 ? "" : "s"} issued.
          </p>
        </div>
        <IssueCardDialog
          merchants={merchants.map((m) => ({ id: m.id, name: m.name, currency: m.currency }))}
        />
      </div>

      {cards.length === 0 ? (
        <div className="border-t border-gray-200 px-4 py-16 text-center sm:px-6 dark:border-gray-800">
          <p className="font-medium text-gray-900 dark:text-gray-50">No cards issued yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Issue a card to give a merchant a virtual number with a limit from day one.
          </p>
        </div>
      ) : (
        <TableRoot className="border-t border-gray-200 dark:border-gray-800">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nickname</TableHeaderCell>
                <TableHeaderCell>Merchant</TableHeaderCell>
                <TableHeaderCell>Number</TableHeaderCell>
                <TableHeaderCell className="text-right">Limit</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
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
                    <TableCell className="font-mono text-gray-500">
                      {maskedNumber(card.last4)}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                      {formatMoney(card.limit, card.currency)}
                    </TableCell>
                    <TableCell>{formatDate(card.createdAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={card.status} />
                    </TableCell>
                    <TableCell>
                      <StatusControl cardId={card.id} status={card.status} />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableRoot>
      )}
    </section>
  )
}
