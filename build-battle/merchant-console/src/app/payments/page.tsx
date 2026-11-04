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
import { queryPayments } from "@/data/queries"
import { PaymentFilters, PaymentStatus } from "@/data/types"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { ExportDialog } from "./export-dialog"
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
  const filters: PaymentFilters = {
    status: (STATUSES.includes(params.status as PaymentStatus)
      ? params.status
      : "all") as PaymentFilters["status"],
    merchantId: params.merchantId || undefined,
    search: params.search || undefined,
    page: Number(params.page ?? "1") || 1,
  }

  const { rows, total, page, pageCount } = queryPayments(filters)
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
  )

  const pageHref = (next: number) => {
    const q = new URLSearchParams(query)
    q.set("page", String(next))
    return `/payments?${q.toString()}`
  }

  return (
    <section aria-label="Payments">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <PaymentsFilterBar
          statuses={STATUSES}
          merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
          current={{
            status: (filters.status as string) ?? "all",
            merchantId: filters.merchantId ?? "",
            search: filters.search ?? "",
          }}
        />
        <ExportDialog filterQuery={query.toString()} />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Payment</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell>Method</TableHeaderCell>
              <TableHeaderCell>Date</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
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
