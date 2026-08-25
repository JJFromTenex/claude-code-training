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
import { queryCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { CardFilters, CardStatus } from "@/data/types"
import { maskedNumber } from "@/lib/card-number"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { Button } from "@/components/Button"
import { IssueCardDrawer } from "./issue-card-drawer"
import { CardStatusActions } from "./card-status-actions"

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
    page: Number(params.page ?? "1") || 1,
  }

  const { rows, total, page, pageCount } = queryCards(filters)
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  )

  const pageHref = (next: number) => {
    const q = new URLSearchParams(query)
    q.set("page", String(next))
    return `/cards?${q.toString()}`
  }

  const filtered = filters.status !== "all" || Boolean(filters.merchantId)

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Issue a card and it is live from the moment it exists.
          </p>
        </div>
        <IssueCardDrawer
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
              <TableHeaderCell className="text-right">
                Spend limit
              </TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>
                <span className="sr-only">Actions</span>
              </TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
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
                      : "Issue one and it will show up here straight away."}
                  </p>
                </TableCell>
              </TableRow>
            )}
            {rows.map((card) => {
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
                    {maskedNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <CardStatusActions id={card.id} status={card.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>

      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <p className="text-sm text-gray-500">
          {total.toLocaleString()} cards · page {page} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="py-1.5"
            disabled={page <= 1}
            asChild={page > 1}
          >
            {page > 1 ? (
              <Link href={pageHref(page - 1)}>Previous</Link>
            ) : (
              <span>Previous</span>
            )}
          </Button>
          <Button
            variant="secondary"
            className="py-1.5"
            disabled={page >= pageCount}
            asChild={page < pageCount}
          >
            {page < pageCount ? (
              <Link href={pageHref(page + 1)}>Next</Link>
            ) : (
              <span>Next</span>
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}
