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
import { CATEGORY_LABELS } from "@/data/card-catalog"
import { cardSpend, listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDialog } from "./issue-card-dialog"

/**
 * The card list. A server component reading the store directly, the way
 * `src/app/payments/page.tsx` calls `queryPayments` rather than fetching its
 * own API. Numbers are masked because the record only holds the last four.
 */
export default async function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {cards.length} issued. Numbers are shown once, at creation.
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
              <TableHeaderCell>Category lock</TableHeaderCell>
              <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
              <TableHeaderCell className="text-right">Spent</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards have been issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Issue one and it appears here straight away.
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
                <TableCell
                  className="font-mono text-gray-500"
                  aria-label={`Card ending ${card.last4}`}
                >
                  {maskCardNumber(card.last4)}
                </TableCell>
                <TableCell className="text-gray-500">
                  {CATEGORY_LABELS[card.categoryLock]}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-gray-500">
                  {formatMoney(cardSpend(card.id), card.currency)}
                </TableCell>
                <TableCell>
                  <CardStatusBadge status={card.status} />
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <CardActions
                    cardId={card.id}
                    nickname={card.nickname}
                    last4={card.last4}
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
