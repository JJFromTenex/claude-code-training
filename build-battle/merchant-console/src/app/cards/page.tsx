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
import { CATEGORY_LABELS, issuableMerchants, listCards } from "@/data/cards"
import { merchantById } from "@/data/merchants"
import { maskLast4 } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDrawer } from "./issue-card-drawer"

/**
 * Issued virtual cards.
 *
 * Reads the store directly the way `src/app/payments/page.tsx` does. Cards
 * carry no full number, so there is nothing here to mask beyond rendering the
 * last four.
 */
export default function CardsPage() {
  const cards = listCards()
  const merchants = issuableMerchants()
  const categories = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  }))

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {cards.length === 0
              ? "No cards issued yet."
              : `${cards.length.toLocaleString()} issued · single-merchant, limited from the moment they exist.`}
          </p>
        </div>
        <IssueCardDrawer merchants={merchants} categories={categories} />
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
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Issue one for a vendor subscription, ad spend, or a
                    contractor tool. It takes a nickname, a merchant, and a
                    limit.
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
                    {card.categoryLock && (
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {CATEGORY_LABELS[card.categoryLock]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{merchant?.name ?? "—"}</TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {maskLast4(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <CardActions
                      cardId={card.id}
                      status={card.status}
                      nickname={card.nickname}
                    />
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
