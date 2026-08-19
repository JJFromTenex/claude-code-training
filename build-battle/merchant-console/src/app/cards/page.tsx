import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { listCards, merchantNameFor } from "@/data/cards"
import { merchants } from "@/data/merchants"
import { maskNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardStatusBadge } from "./card-status-badge"
import { FreezeToggle } from "./freeze-toggle"
import { IssueCardDialog } from "./issue-card-dialog"

export const dynamic = "force-dynamic"

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">Virtual cards</h1>
          <p className="text-sm text-gray-500">
            Single-merchant cards issued from the console. Numbers are shown once, at issue.
          </p>
        </div>
        <IssueCardDialog merchants={merchants.map((m) => ({ id: m.id, name: m.name }))} />
      </div>

      {cards.length === 0 ? (
        <div className="mx-4 mb-6 rounded-md border border-dashed border-gray-300 p-10 text-center sm:mx-6 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-50">No cards issued yet</p>
          <p className="mt-1 text-sm text-gray-500">
            Ops used to ask the platform team for these over Slack. Issue the first one from here and
            it appears in this list with its number masked.
          </p>
        </div>
      ) : (
        <TableRoot className="border-t border-gray-200 dark:border-gray-800">
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>Nickname</TableHeaderCell>
                <TableHeaderCell>Merchant</TableHeaderCell>
                <TableHeaderCell>Number</TableHeaderCell>
                <TableHeaderCell className="text-right">Limit</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Created</TableHeaderCell>
                <TableHeaderCell className="text-right">
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cards.map((card) => (
                <TableRow key={card.id}>
                  <TableCell className="font-medium text-gray-900 dark:text-gray-50">
                    <Link href={`/cards/${card.id}`} className="hover:underline">
                      {card.nickname}
                    </Link>
                  </TableCell>
                  <TableCell>{merchantNameFor(card)}</TableCell>
                  <TableCell className="font-mono tabular-nums">{maskNumber(card.last4)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <CardStatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <FreezeToggle id={card.id} status={card.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableRoot>
      )}
    </section>
  )
}
