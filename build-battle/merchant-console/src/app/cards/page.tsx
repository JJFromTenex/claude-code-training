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
import { maskCard } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardRowActions } from "./card-row-actions"
import { IssueCardDrawer } from "./issue-card-drawer"

export default function CardsPage() {
  const cards = [...store.cards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  const merchantOptions = merchants.map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    currency: merchant.currency,
  }))

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {cards.length} card{cards.length === 1 ? "" : "s"} issued.
          </p>
        </div>
        <IssueCardDrawer merchants={merchantOptions} />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell className="text-right">Limit</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
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
                <TableCell colSpan={8} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Use Issue card, above, to create the first one.
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
                  <TableCell className="font-mono text-gray-500">
                    {maskCard(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.limitMinorUnits, card.currency)}
                  </TableCell>
                  <TableCell className="capitalize">{card.category}</TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell>
                    <CardRowActions id={card.id} status={card.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
