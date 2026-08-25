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
import { listCards } from "@/data/queries"
import { CARD_CATEGORIES, CURRENCIES, maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardActions } from "./card-actions"
import { IssueCardDialog } from "./issue-dialog"

export default function CardsPage() {
  const cards = listCards()

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Single merchant, always virtual, with a limit from the moment they exist.
          </p>
        </div>
        <IssueCardDialog
          merchants={merchants.map((m) => ({
            id: m.id,
            name: m.name,
            currency: m.currency,
          }))}
          categories={[...CARD_CATEGORIES]}
          currencies={[...CURRENCIES]}
        />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              {["Nickname", "Merchant", "Number"].map((h) => (
                <TableHeaderCell key={h}>{h}</TableHeaderCell>
              ))}
              <TableHeaderCell className="text-right">Spend limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Issued</TableHeaderCell>
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
                    Issue one and it appears here. Ops no longer has to ask the
                    platform team.
                  </p>
                </TableCell>
              </TableRow>
            )}
            {cards.map((card) => (
              <TableRow key={card.id}>
                <TableCell>
                  <Link href={`/cards/${card.id}`}
                    className="font-medium text-blue-600 hover:underline dark:text-blue-500">
                    {card.nickname}
                  </Link>
                </TableCell>
                <TableCell>{merchantById(card.merchantId)?.name}</TableCell>
                <TableCell className="font-mono text-gray-500">
                  {maskCardNumber(card.last4)}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                  {formatMoney(card.spendLimit, card.currency)}
                </TableCell>
                <TableCell><StatusBadge status={card.status} /></TableCell>
                <TableCell>{formatDate(card.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <CardActions cardId={card.id} status={card.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
