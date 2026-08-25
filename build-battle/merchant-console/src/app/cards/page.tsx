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
import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCard } from "./issue-card"

export default async function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="text-sm text-gray-500">
            {cards.length === 0
              ? "Single-merchant cards with a limit from the moment they exist."
              : `${cards.length} issued · numbers are shown once, at issue`}
          </p>
        </div>
        <IssueCard
          merchants={merchants.map((m) => ({
            id: m.id,
            name: m.name,
            currency: m.currency,
          }))}
        />
      </div>

      {cards.length === 0 ? (
        <div className="mx-4 rounded-md border border-dashed border-gray-300 p-10 text-center sm:mx-6 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
            No cards issued yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Issue the first one and it will appear here with its last four,
            limit, and status.
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
                <TableHeaderCell>Category</TableHeaderCell>
                <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link
                      href={`/cards/${card.id}`}
                      className="font-medium text-gray-900 hover:underline dark:text-gray-50"
                    >
                      {card.nickname}
                    </Link>
                  </TableCell>
                  <TableCell>{merchantById(card.merchantId)?.name ?? card.merchantId}</TableCell>
                  <TableCell className="font-mono">{maskCard(card.last4)}</TableCell>
                  <TableCell className="capitalize">{card.category}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(card.spendLimit, card.currency)}
                    <span className="ml-1 text-gray-500">{card.currency}</span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <CardActions id={card.id} status={card.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      )}
    </section>
  )
}
