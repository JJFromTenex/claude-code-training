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
import { Badge } from "@/components/Badge"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import Link from "next/link"
import { IssueCardDialog } from "./IssueCardDialog"

export default async function CardsPage() {
  const res = await fetch("http://localhost:3000/api/cards", { cache: "no-store" })
  const cards = (await res.json()) ?? []

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-blue-100 to-emerald-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Mountain background SVG */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "rgb(135, 206, 235)", stopOpacity: 0.4 }} />
            <stop offset="100%" style={{ stopColor: "rgb(100, 180, 220)", stopOpacity: 0.2 }} />
          </linearGradient>
        </defs>
        {/* Far snowy peaks */}
        <polygon points="50,400 200,250 350,350 500,200 650,320 800,180 950,300 1000,280 1000,600 0,600" fill="rgb(209, 213, 219)" opacity="0.5" />
        {/* Mid mountains */}
        <polygon points="0,450 120,320 280,400 420,280 600,380 750,240 900,350 1000,320 1000,600 0,600" fill="rgb(107, 114, 128)" opacity="0.4" />
        {/* Close evergreen mountains */}
        <polygon points="0,500 80,380 200,480 350,320 500,420 700,280 850,400 1000,340 1000,600 0,600" fill="rgb(34, 197, 94)" opacity="0.25" />
      </svg>

      <section aria-label="Virtual Cards" className="relative z-10">
        <div className="flex flex-col justify-between gap-2 px-4 py-6 sm:flex-row sm:items-center sm:p-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Virtual Cards</h1>
          <IssueCardDialog />
        </div>

        <TableRoot className="border-t border-gray-200 dark:border-gray-800">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nickname</TableHeaderCell>
              <TableHeaderCell>Merchant</TableHeaderCell>
              <TableHeaderCell>Card Number</TableHeaderCell>
              <TableHeaderCell className="text-right">Limit</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Created</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cards.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-16 text-center">
                  <p className="font-medium text-gray-900 dark:text-gray-50">No cards issued yet</p>
                  <p className="mt-1 text-gray-500">Issue your first virtual card to get started.</p>
                </TableCell>
              </TableRow>
            ) : (
              cards.map((card: any) => (
                <TableRow key={card.id}>
                  <TableCell>
                    <Link href={`/cards/${card.id}`} className="text-blue-600 hover:underline">
                      {card.nickname}
                    </Link>
                  </TableCell>
                  <TableCell>{card.merchantName || card.merchantId}</TableCell>
                  <TableCell className="font-mono text-sm">•••• {card.last4}</TableCell>
                  <TableCell className="text-right">
                    {formatMoney(card.limit, card.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        card.status === "active"
                          ? "bg-green-100 text-green-900 dark:bg-green-900 dark:text-green-100"
                          : card.status === "frozen"
                            ? "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100"
                            : "bg-red-100 text-red-900 dark:bg-red-900 dark:text-red-100"
                      }
                    >
                      {card.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-gray-500">{formatDate(card.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableRoot>
      </section>
    </div>
  )
}
