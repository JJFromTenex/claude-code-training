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
import { CardFilters, CardStatus } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { CardsFilterBar } from "./filter-bar"
import { IssueCardDialog } from "./issue-dialog"

const STATUSES: (CardStatus | "all")[] = [
  "all",
  "active",
  "frozen",
  "cancelled",
]

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const filters: CardFilters = {
    status: (STATUSES.includes(params.status as CardStatus)
      ? params.status
      : "all") as CardFilters["status"],
    merchantId: params.merchantId || undefined,
  }

  const cards = listCards(filters)
  const filtered = filters.status !== "all" || Boolean(filters.merchantId)

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <CardsFilterBar
          statuses={STATUSES}
          merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
          current={{
            status: (filters.status as string) ?? "all",
            merchantId: filters.merchantId ?? "",
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
              <TableHeaderCell>Card</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell className="text-right">
                Spend limit
              </TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    {filtered
                      ? "No cards match these filters"
                      : "No cards issued yet"}
                  </p>
                  <p className="mt-1 text-gray-500">
                    {filtered
                      ? "Clear the filters to see every card."
                      : "Issue one and it appears here straight away."}
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
                    {maskCardNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell>
                    <CardActions
                      cardId={card.id}
                      status={card.status}
                      size="compact"
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
