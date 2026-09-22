import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { CARD_CATEGORY_LABELS, maskCard } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { IssueCardDrawer } from "./issue-drawer"
import { ListStatusCell } from "./list-status-cell"

export default function CardsPage() {
  const cards = listCards()
  const merchantOptions = merchants.map((m) => ({
    id: m.id,
    name: m.name,
    currency: m.currency,
  }))

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-3 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Issue single-merchant virtual cards and track spend against their limits.
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
              <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
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
                    Issue your first virtual card to replace the manual Slack request.
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
                  <p className="text-xs text-gray-500">
                    {CARD_CATEGORY_LABELS[card.category]}
                  </p>
                </TableCell>
                <TableCell>{merchantById(card.merchantId)?.name}</TableCell>
                <TableCell className="tabular-nums text-gray-500">
                  {maskCard(card.last4)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.limit, card.currency)}
                </TableCell>
                <TableCell>
                  <ListStatusCell id={card.id} status={card.status} />
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
