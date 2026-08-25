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
import {
  CARD_STATUS_FILTERS,
  CATEGORY_LABELS,
  cardSpend,
  listCards,
  parseCardFilters,
} from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { formatDate } from "@/lib/dates"
import { maskCardNumber } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { CardsFilterBar } from "./filter-bar"
import { IssueCardDialog } from "./issue-card-dialog"

/**
 * The card list.
 *
 * A server component reading the store directly, the way
 * `src/app/payments/page.tsx` calls `queryPayments` rather than fetching its
 * own API. Numbers are masked here because the record only has the last four
 * to begin with.
 */
export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const filters = parseCardFilters(
    new URLSearchParams(
      Object.entries(params).filter(([, value]) => Boolean(value)) as [
        string,
        string,
      ][],
    ),
  )

  const cards = listCards(filters)
  const filtered =
    filters.status !== "all" || filters.merchantId || filters.search

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <CardsFilterBar
          statuses={CARD_STATUS_FILTERS}
          merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
          current={{
            status: filters.status ?? "all",
            merchantId: filters.merchantId ?? "",
            search: filters.search ?? "",
          }}
        />
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
                    {filtered
                      ? "No cards match these filters"
                      : "No cards have been issued yet"}
                  </p>
                  <p className="mt-1 text-gray-500">
                    {filtered
                      ? "Clear the search or pick a different status."
                      : "Issue one and it will appear here straight away."}
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => {
              const merchant = merchantById(card.merchantId)
              const spent = cardSpend(card.id)
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
                    {maskCardNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {CATEGORY_LABELS[card.categoryLock]}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-gray-500">
                    {formatMoney(spent, card.currency)}
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
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>

      <div className="px-4 py-4 sm:px-6">
        <p className="text-sm text-gray-500">
          {cards.length.toLocaleString()}{" "}
          {cards.length === 1 ? "card" : "cards"}
        </p>
      </div>
    </section>
  )
}
