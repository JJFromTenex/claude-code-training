import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRoot,
  TableRow,
} from "@/components/Table"
import { CardStatusBadge } from "@/components/ui/cards/CardStatusBadge"
import { merchantById, merchants } from "@/data/merchants"
import { store } from "@/data/store"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { mask } from "@/lib/cards"
import Link from "next/link"
import { FreezeButton } from "./freeze-button"
import { IssueDrawer } from "./issue-drawer"

const CATEGORY_LABELS = {
  retail: "Retail",
  marketplace: "Marketplace",
  subscription: "Subscription",
  services: "Services",
} as const

export default function CardsPage() {
  const cards = store.cards

  return (
    <section aria-label="Cards">
      <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {cards.length.toLocaleString()}{" "}
            {cards.length === 1 ? "card" : "cards"} issued.
          </p>
        </div>
        <IssueDrawer
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
              <TableHeaderCell>Category</TableHeaderCell>
              <TableHeaderCell className="text-right">Limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">
                    No cards yet
                  </p>
                  <p className="mt-1 text-gray-500">
                    Issue one from the button above. Cards live in memory and
                    reset when the dev server restarts.
                  </p>
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
                  <TableCell className="font-mono text-sm">
                    {mask(card.last4)}
                  </TableCell>
                  <TableCell>{CATEGORY_LABELS[card.category]}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <CardStatusBadge status={card.status} />
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {formatDate(card.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <FreezeButton cardId={card.id} status={card.status} />
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
