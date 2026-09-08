import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRoot, TableRow } from "@/components/Table"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { IssueCardDrawer } from "./issue-drawer"
import { CardRowActions } from "./row-actions"

export default function CardsPage() {
  const cards = listCards()
  // The drawer only ever needs enough of a merchant to name it and lock its currency.
  const issuable = merchants.map((m) => ({ id: m.id, name: m.name, currency: m.currency }))

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {cards.length} issued. Newest first.
          </p>
        </div>
        <IssueCardDrawer merchants={issuable} />
      </div>

      {cards.length === 0 ? (
        <div className="border-t border-gray-200 px-4 py-16 text-center dark:border-gray-800 sm:px-6">
          <p className="font-medium text-gray-900 dark:text-gray-50">
            No cards have been issued yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            A virtual card belongs to one merchant and carries a limit from the moment
            it exists. Issue the first one and it lands here, masked.
          </p>
          <div className="mt-6 flex justify-center">
            <IssueCardDrawer merchants={issuable} triggerLabel="Issue the first card" />
          </div>
        </div>
      ) : (
        <TableRoot className="border-t border-gray-200 dark:border-gray-800">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Card</TableHeaderCell>
                <TableHeaderCell>Merchant</TableHeaderCell>
                <TableHeaderCell>Number</TableHeaderCell>
                <TableHeaderCell>Category lock</TableHeaderCell>
                <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell className="text-right">Actions</TableHeaderCell>
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
                    <TableCell className="font-mono">{maskCard(card.last4)}</TableCell>
                    <TableCell className="capitalize text-gray-500">
                      {card.categoryLock ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                      {formatMoney(card.spendLimit, card.currency)}
                    </TableCell>
                    <TableCell>
                      <CardStatusBadge status={card.status} />
                    </TableCell>
                    <TableCell>{formatDate(card.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <CardRowActions cardId={card.id} status={card.status} />
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
