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
import { merchantById, merchants } from "@/data/merchants"
import { listCards } from "@/data/queries"
import { formatDate } from "@/lib/dates"
import { maskedNumber } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { IssueCardDialog } from "./issue-dialog"

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Cards
          </h1>
          <p className="text-sm text-gray-500">
            Virtual cards issued from the console. Numbers are generated on the
            4242 test BIN and shown once at issue.
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
              <TableHeaderCell className="text-right">Limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Click <span className="font-medium">Issue card</span> to
                    create the first one. It appears here immediately.
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
                  <TableCell>{merchant?.name ?? card.merchantId}</TableCell>
                  <TableCell className="font-mono text-gray-500">
                    {maskedNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <CardStatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
