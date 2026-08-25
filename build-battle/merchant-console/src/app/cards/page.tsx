import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskCard } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardStatusActions } from "./card-actions"
import { IssueCardDialog } from "./issue-card-dialog"

// The list reads the in-memory store per request; never prerender a snapshot.
export const dynamic = "force-dynamic"

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="text-sm text-gray-500">
            Single-merchant cards issued by ops. The full number is shown once,
            at issue.
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
              <TableHeaderCell className="text-right">
                Spend limit
              </TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Issue the first one and it will appear here, masked to its
                    last four digits.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell>
                  <Link
                    href={`/cards/${card.id}`}
                    className="font-medium text-gray-900 hover:underline dark:text-gray-50"
                  >
                    {card.nickname}
                  </Link>
                </TableCell>
                <TableCell>{merchantById(card.merchantId)?.name ?? "—"}</TableCell>
                <TableCell className="font-mono">{maskCard(card.last4)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell>
                  <CardStatusActions
                    cardId={card.id}
                    initialStatus={card.status}
                  />
                </TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
