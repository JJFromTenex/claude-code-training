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
import { formatDate } from "@/lib/dates"
import { maskCardNumber } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { IssueCardDrawer } from "./issue-drawer"
import { CardRowActions } from "./row-actions"

const options = merchants.map((m) => ({
  id: m.id,
  name: m.name,
  currency: m.currency,
}))

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
            {cards.length} issued. Newest first.
          </p>
        </div>
        <IssueCardDrawer merchants={options} />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Card</TableHeaderCell>
              <TableHeaderCell>Category lock</TableHeaderCell>
              <TableHeaderCell className="text-right">
                Spend limit
              </TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards have been issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Issuing one here sets the spend limit up front, instead of a
                    request to the platform team.
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
                <TableCell className="tabular-nums">
                  {maskCardNumber(card.last4)}
                </TableCell>
                <TableCell className="capitalize text-gray-500">
                  {card.categoryLock ?? "None"}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={card.status} />
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
                <TableCell>
                  <CardRowActions
                    id={card.id}
                    nickname={card.nickname}
                    status={card.status}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>

      <p className="px-4 py-4 text-sm text-gray-500 sm:px-6">
        Cards live in memory and reset when the dev server restarts. Persistence
        is NWP-203.
      </p>
    </section>
  )
}
