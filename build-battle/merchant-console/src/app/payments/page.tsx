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
import { merchantById, merchants } from "@/data/merchants"
import {
  CARD_BRANDS,
  CURRENCIES,
  METHODS,
  filterPayments,
  paginate,
  parseFilters,
  sortPayments,
  summarizePayments,
} from "@/data/queries"
import { PaymentSort, PaymentStatus } from "@/data/types"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { ArrowDown, ArrowUp, Download } from "lucide-react"
import Link from "next/link"
import { PaymentsFilterBar } from "./filter-bar"

const STATUSES: (PaymentStatus | "all")[] = [
  "all",
  "captured",
  "authorized",
  "refunded",
  "disputed",
  "failed",
]

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  )

  // One allowlist for the whole console: the same parser the API routes use.
  const filters = parseFilters(query)

  const filtered = filterPayments(filters)
  const sorted = sortPayments(filtered, filters.sort, filters.direction)
  const { rows, total, page, pageCount } = paginate(sorted, filters.page)
  const summary = summarizePayments(filtered)

  const pageHref = (next: number) => {
    const q = new URLSearchParams(query)
    q.set("page", String(next))
    return `/payments?${q.toString()}`
  }

  const sortHref = (key: PaymentSort) => {
    const q = new URLSearchParams(query)
    q.set("sort", key)
    q.set("direction", filters.sort === key && filters.direction === "asc" ? "desc" : "asc")
    q.delete("page")
    return `/payments?${q.toString()}`
  }

  const SortableHeader = ({
    label,
    sortKey,
    align = "left",
  }: {
    label: string
    sortKey: PaymentSort
    align?: "left" | "right"
  }) => {
    const active = filters.sort === sortKey
    const Arrow = active && filters.direction === "asc" ? ArrowUp : ArrowDown
    return (
      <TableHeaderCell className={align === "right" ? "text-right" : undefined}>
        <Link
          href={sortHref(sortKey)}
          aria-label={`Sort by ${label}`}
          className={`inline-flex items-center gap-1 hover:text-gray-900 dark:hover:text-gray-50 ${
            align === "right" ? "flex-row-reverse" : ""
          } ${active ? "text-gray-900 dark:text-gray-50" : ""}`}
        >
          {label}
          <Arrow
            className={`size-3.5 shrink-0 ${active ? "opacity-100" : "opacity-0 group-hover:opacity-40"}`}
            aria-hidden="true"
          />
        </Link>
      </TableHeaderCell>
    )
  }

  return (
    <section aria-label="Payments">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-start sm:p-6">
        <PaymentsFilterBar
          statuses={STATUSES}
          methods={[...METHODS]}
          cardBrands={[...CARD_BRANDS]}
          currencies={[...CURRENCIES]}
          merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
          current={{
            status: (filters.status as string) ?? "all",
            merchantId: filters.merchantId ?? "",
            search: filters.search ?? "",
            method: (filters.method as string) ?? "all",
            cardBrand: (filters.cardBrand as string) ?? "all",
            currency: filters.currency ?? "",
            // Only echo amounts the gate actually accepted, so rejected input
            // never looks like an active filter.
            minAmount: filters.currency ? (params.minAmount ?? "") : "",
            maxAmount: filters.currency ? (params.maxAmount ?? "") : "",
            from: filters.from ?? "",
            to: filters.to ?? "",
            sort: filters.sort ?? "createdAt",
            direction: filters.direction ?? "desc",
          }}
        />
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit" asChild>
          <a href={`/api/payments/export?${query.toString()}`}>
            <Download
              className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
              aria-hidden="true"
            />
            Export
          </a>
        </Button>
      </div>

      <div
        aria-label="Totals for the current filters"
        className="flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-gray-200 px-4 py-3 dark:border-gray-800 sm:px-6"
      >
        <p className="text-sm text-gray-500">
          <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {summary.count.toLocaleString()}
          </span>{" "}
          {summary.count === 1 ? "payment" : "payments"}
        </p>
        {summary.totals.map((totalFor) => (
          <p key={totalFor.currency} className="text-sm text-gray-500">
            {totalFor.currency}{" "}
            <span className="font-medium tabular-nums text-gray-900 dark:text-gray-50">
              {formatMoney(totalFor.amount, totalFor.currency)}
            </span>
          </p>
        ))}
        {summary.totals.length === 0 && (
          <p className="text-sm text-gray-500">Nothing to total</p>
        )}
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Payment</TableHeaderCell>
              <SortableHeader label="Merchant" sortKey="merchant" />
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Method</TableHeaderCell>
              <SortableHeader label="Date" sortKey="createdAt" />
              <SortableHeader label="Amount" sortKey="amount" align="right" />
              <SortableHeader label="Status" sortKey="status" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No payments match these filters
                  </p>
                  <p className="mt-1 text-gray-500">
                    Clear the search or pick a different status.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {rows.map((payment) => {
              const merchant = merchantById(payment.merchantId)
              return (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link
                      href={`/payments/${payment.id}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                      {payment.id}
                    </Link>
                  </TableCell>
                  <TableCell>{merchant?.name}</TableCell>
                  <TableCell className="text-gray-500">
                    {payment.description}
                  </TableCell>
                  <TableCell className="capitalize">
                    {payment.method === "card"
                      ? `${payment.cardBrand} •••• ${payment.last4}`
                      : payment.method.replace("_", " ")}
                  </TableCell>
                  <TableCell>{formatDate(payment.createdAt)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(payment.amount, payment.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>

      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <p className="text-sm text-gray-500">
          {total.toLocaleString()} payments · page {page} of {pageCount}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="py-1.5" disabled={page <= 1} asChild={page > 1}>
            {page > 1 ? <Link href={pageHref(page - 1)}>Previous</Link> : <span>Previous</span>}
          </Button>
          <Button
            variant="secondary"
            className="py-1.5"
            disabled={page >= pageCount}
            asChild={page < pageCount}
          >
            {page < pageCount ? <Link href={pageHref(page + 1)}>Next</Link> : <span>Next</span>}
          </Button>
        </div>
      </div>
    </section>
  )
}
