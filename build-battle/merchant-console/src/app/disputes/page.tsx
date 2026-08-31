import { Badge } from "@/components/Badge"
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
import { GENERATED_AT } from "@/data/generate"
import { merchantById } from "@/data/merchants"
import { store } from "@/data/store"
import { daysUntil, formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"

function isOpen(status: string) {
  return status === "needs_response" || status === "under_review"
}

/**
 * Only a dispute still waiting on evidence has a deadline anyone can act on
 * — once it's under_review the evidence is already in. Three tiers, reusing
 * the Badge variants the rest of the app already uses for severity:
 * overdue/within 48h is the same "error" red as a failed payment, the
 * five-day heads-up is "warning" amber, anything further out gets no badge
 * so the table isn't flagging things nobody needs to act on yet.
 */
function DeadlineBadge({ remaining }: { remaining: number }) {
  if (remaining <= 0) {
    return <Badge variant="error">Overdue</Badge>
  }
  if (remaining <= 2) {
    return <Badge variant="error">Due in {remaining}d</Badge>
  }
  if (remaining <= 5) {
    return <Badge variant="warning">Due in {remaining}d</Badge>
  }
  return null
}

export default function DisputesPage() {
  // Open disputes first — sorting the whole list by evidenceDueAt put
  // long-resolved cases (their deadline is in the past) ahead of the ones
  // that still need action, which defeated the point of sorting by deadline
  // at all.
  const disputes = [...store.disputes].sort((a, b) => {
    const aOpen = isOpen(a.status)
    const bOpen = isOpen(b.status)
    if (aOpen !== bOpen) return aOpen ? -1 : 1
    return a.evidenceDueAt.localeCompare(b.evidenceDueAt)
  })

  const open = disputes.filter((d) => isOpen(d.status))

  return (
    <section aria-label="Disputes">
      <div className="p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Disputes
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {open.length} open of {disputes.length}. Open disputes shown first,
          soonest deadline at top.
        </p>
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Dispute</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell>Opened</TableHeaderCell>
              <TableHeaderCell>Evidence due</TableHeaderCell>
              <TableHeaderCell className="text-right">Amount</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {disputes.map((dispute) => {
              const remaining = daysUntil(dispute.evidenceDueAt, GENERATED_AT)
              const needsAction = dispute.status === "needs_response"
              return (
                <TableRow key={dispute.id}>
                  <TableCell>
                    <Link
                      href={`/payments/${dispute.paymentId}`}
                      className="font-medium text-blue-600 hover:underline dark:text-blue-500"
                    >
                      {dispute.id}
                    </Link>
                  </TableCell>
                  <TableCell>{merchantById(dispute.merchantId)?.name}</TableCell>
                  <TableCell className="text-gray-500">
                    {dispute.reasonCode}
                  </TableCell>
                  <TableCell>{formatDate(dispute.openedAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-900 dark:text-gray-50">
                        {formatDate(dispute.evidenceDueAt)}
                      </span>
                      {needsAction && <DeadlineBadge remaining={remaining} />}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(dispute.amount, dispute.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={dispute.status} />
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
