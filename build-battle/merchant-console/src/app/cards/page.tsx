import { Button } from "@/components/Button"
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
import { CARD_STATUSES, parseCardFilters, queryCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { IssueCardDialog } from "./issue-dialog"
import { CardStatusActions } from "./status-actions"

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  )

  // The same parser the route handler uses, so the page cannot accept a
  // filter the API would reject.
  const filters = parseCardFilters(query)
  const { rows, total, page, pageCount } = queryCards(filters)

  const statusHref = (status: string) => {
    const q = new URLSearchParams(query)
    if (status === "all") q.delete("status")
    else q.set("status", status)
    q.delete("page")
    return `/cards?${q.toString()}`
  }

  const pageHref = (next: number) => {
    const q = new URLSearchParams(query)
    q.set("page", String(next))
    return `/cards?${q.toString()}`
  }

  const activeStatus = (filters.status as string) ?? "all"
  const filtered = activeStatus !== "all" || Boolean(filters.search)

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-3 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Filter by status"
        >
          {CARD_STATUSES.map((status) => (
            <Button
              key={status}
              variant={activeStatus === status ? "primary" : "secondary"}
              className="py-1 capitalize"
              asChild
            >
              <Link href={statusHref(status)}>{status}</Link>
            </Button>
          ))}
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
              <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
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
                  {filtered ? (
                    <>
                      <p className="font-medium text-gray-900 dark:text-gray-50">
                        No cards match these filters
                      </p>
                      <p className="mt-1 text-gray-500">
                        Clear the search or pick a different status.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900 dark:text-gray-50">
                        No cards issued yet
                      </p>
                      <p className="mt-1 text-gray-500">
                        Issue one and it appears here. The full number is shown
                        once, at issue time.
                      </p>
                    </>
                  )}
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
                    {card.category && (
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {card.category}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{merchant?.name ?? card.merchantId}</TableCell>
                  <TableCell className="font-mono tabular-nums text-gray-500">
                    {maskCardNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell>
                    <CardStatusActions cardId={card.id} status={card.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>

      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <p className="text-sm text-gray-500">
          {total.toLocaleString()} {total === 1 ? "card" : "cards"} · page {page}{" "}
          of {pageCount}
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
