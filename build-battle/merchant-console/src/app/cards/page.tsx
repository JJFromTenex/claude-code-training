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
import { CARD_CATEGORIES, listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { CardStatusActions } from "./card-status-actions"
import { IssueCardDrawer } from "./issue-card-drawer"

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const page = Number(params.page ?? "1") || 1
  const { rows, total, pageCount } = listCards(page)

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Issue a card for a vendor subscription, ad spend, or a contractor
            tool.
          </p>
        </div>
        <IssueCardDrawer
          merchants={merchants.map((m) => ({ id: m.id, name: m.name }))}
          categories={[...CARD_CATEGORIES]}
        />
      </div>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Card</TableHeaderCell>
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell className="text-right">Limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards issued yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Issue a card and it will appear here. Numbers are generated
                    when you submit and shown once.
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
                  <TableCell>{merchant?.name ?? card.merchantId}</TableCell>
                  <TableCell className="font-mono">
                    {maskCardNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {CATEGORY_LABELS[card.category] ?? card.category}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell>
                    <CardStatusActions id={card.id} status={card.status} />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>

      {total > 0 && (
        <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-sm text-gray-500">
            {total.toLocaleString()} {total === 1 ? "card" : "cards"} · page{" "}
            {page} of {pageCount}
          </p>
        </div>
      )}
    </section>
  )
}
