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
import { cardCountsByStatus, listCards } from "@/data/cards"
import { merchantById, merchants } from "@/data/merchants"
import { CardStatus } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { cx } from "@/lib/utils"
import Link from "next/link"
import { CardStatusActions } from "../card-actions"
import { IssueCardDrawer } from "../issue-drawer"

const STATUSES: (CardStatus | "all")[] = ["all", "active", "frozen", "cancelled"]

const STATUS_LABELS: Record<CardStatus | "all", string> = {
  all: "All",
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const params = await searchParams
  const status = (
    STATUSES.includes(params.status as CardStatus) ? params.status : "all"
  ) as CardStatus | "all"

  const cards = listCards({ status })
  const counts = cardCountsByStatus()

  return (
    <section aria-label="Virtual cards">
      <div className="flex flex-col justify-between gap-4 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">
            Virtual cards
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Issue a card for a merchant and track spend against its limit.
          </p>
        </div>
        <IssueCardDrawer
          merchants={merchants.map((m) => ({
            id: m.id,
            name: m.name,
            currency: m.currency,
          }))}
        />
      </div>

      <nav
        aria-label="Filter cards by status"
        className="flex flex-wrap gap-2 px-4 pb-4 sm:px-6"
      >
        {STATUSES.map((option) => (
          <Link
            key={option}
            href={option === "all" ? "/cards" : `/cards?status=${option}`}
            aria-current={option === status ? "page" : undefined}
            className={cx(
              "rounded-md px-2.5 py-1 text-sm font-medium transition",
              option === status
                ? "bg-gray-900 text-white dark:bg-gray-50 dark:text-gray-900"
                : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800",
            )}
          >
            {STATUS_LABELS[option]}
            <span className="ml-1.5 tabular-nums opacity-60">
              {counts[option]}
            </span>
          </Link>
        ))}
      </nav>

      <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Number</TableHeaderCell>
              <TableHeaderCell className="text-right">Limit</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell className="text-right">Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center">
                  {counts.all === 0 ? (
                    <>
                      <p className="font-medium text-gray-900 dark:text-gray-50">
                        No cards yet
                      </p>
                      <p className="mt-1 text-gray-500">
                        Issue one and it will appear here straight away.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-gray-900 dark:text-gray-50">
                        No {STATUS_LABELS[status].toLowerCase()} cards
                      </p>
                      <p className="mt-1 text-gray-500">
                        {counts.all.toLocaleString()} cards exist in total.{" "}
                        <Link
                          href="/cards"
                          className="text-blue-600 hover:underline dark:text-blue-500"
                        >
                          Show all
                        </Link>
                        .
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
                  <TableCell>{merchant?.name}</TableCell>
                  <TableCell className="font-mono text-gray-500">
                    {maskCardNumber(card.last4)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(card.spendLimit, card.currency)}
                  </TableCell>
                  <TableCell>{formatDate(card.createdAt)}</TableCell>
                  <TableCell>
                    <StatusBadge status={card.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <CardStatusActions
                      cardId={card.id}
                      status={card.status}
                      nickname={card.nickname}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableRoot>

      <div className="px-4 py-4 sm:px-6">
        <p className="text-sm text-gray-500">
          {cards.length.toLocaleString()}{" "}
          {cards.length === 1 ? "card" : "cards"} shown
        </p>
      </div>
    </section>
  )
}
