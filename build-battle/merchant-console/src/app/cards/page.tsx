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
import { listCards } from "@/data/card-queries"
import { merchantById, merchants } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CancelledToggle } from "./cancelled-toggle"
import { IssueCardDialog } from "./issue-card-dialog"

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  // Only the literal "1" opts in, matching the list route's allowlist.
  const includeCancelled = params.includeCancelled === "1"

  const cards = listCards({ includeCancelled })
  const everyCard = listCards({ includeCancelled: true })
  const cancelledCount = everyCard.filter(
    (card) => card.status === "cancelled",
  ).length

  const merchantOptions = merchants.map((merchant) => ({
    id: merchant.id,
    name: merchant.name,
    currency: merchant.currency,
  }))

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-3 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Cards
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Virtual cards issued from the console. The full number is shown
            once, at issue, and never again.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <CancelledToggle
            includeCancelled={includeCancelled}
            cancelledCount={cancelledCount}
          />
          <IssueCardDialog merchants={merchantOptions} />
        </div>
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Card</TableHeaderCell>
              <TableHeaderCell className="text-right">
                Spend limit
              </TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Issued</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  {everyCard.length === 0 ? (
                    <>
                      <p className="font-medium text-gray-900 dark:text-gray-50">
                        No cards issued yet
                      </p>
                      <p className="mt-1 text-gray-500">
                        Issue one and it appears here. These are virtual cards
                        on a test BIN, so nothing is ever really charged.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900 dark:text-gray-50">
                        No active cards
                      </p>
                      <p className="mt-1 text-gray-500">
                        Every card has been cancelled. Tick &quot;Show cancelled&quot; to
                        see {cancelledCount === 1 ? "it" : "all " + cancelledCount}.
                      </p>
                    </>
                  )}
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
                  <TableCell className="font-mono">
                    {maskCardNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>
    </section>
  )
}
