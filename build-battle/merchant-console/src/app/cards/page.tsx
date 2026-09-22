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
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { maskCardNumber } from "@/lib/cards"
import Link from "next/link"
import { CardStatusControl } from "./[id]/status-control"
import { IssueCardDrawer } from "./issue-card-drawer"

export default function CardsPage() {
  const cards = [...store.cards].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )

  return (
    <section aria-label="Cards">
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Issue and manage virtual cards for merchant spend.
          </p>
        </div>
        <IssueCardDrawer />
      </div>

      {cards.length === 0 ? (
        <div className="mx-4 mb-6 rounded-md border border-dashed border-gray-300 p-10 text-center sm:mx-6 dark:border-gray-800">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
            No cards issued yet
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Cards issued here live for this session and reset when the dev
            server restarts. Issue your first one to get started.
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
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                    <Link
                      href={`/cards/${card.id}`}
                      className="hover:underline focus-visible:underline"
                    >
                      {card.nickname}
                    </Link>
                  </TableCell>
                  <TableCell>{merchantById(card.merchantId)?.name}</TableCell>
                  <TableCell className="font-mono">
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
                    <CardStatusControl cardId={card.id} status={card.status} compact />
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
