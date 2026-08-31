import { Badge } from "@/components/Badge"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { FreezeButton } from "./FreezeButton"

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const res = await fetch(`http://localhost:3000/api/cards/${id}`, { cache: "no-store" })
  if (!res.ok) {
    notFound()
  }
  const card = await res.json()

  const spendPercent = Math.min(100, Math.round((card.spend / card.limit) * 100))
  const isOverSpend = card.spend > card.limit

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sky-300 via-blue-100 to-emerald-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Mountain background SVG */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 1000 600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="skyGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
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

      <div className="relative z-10 space-y-6 px-4 py-6 sm:p-6">
      <div className="flex items-center gap-4">
        <Link
          href="/cards"
          className="inline-flex items-center gap-2 text-blue-600 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to cards
        </Link>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">{card.nickname}</h1>
            <p className="mt-1 text-gray-500">{card.merchantName}</p>
          </div>
          <div className="flex items-center gap-3">
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
            {card.status !== "cancelled" && <FreezeButton cardId={card.id} status={card.status} />}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Card Number</p>
            <p className="font-mono text-lg text-gray-900 dark:text-gray-50">•••• {card.last4}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Currency</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">{card.currency}</p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Spending Limit</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">
              {formatMoney(card.limit, card.currency)}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-gray-900 dark:text-gray-50">{formatDate(card.createdAt)}</p>
          </div>
        </div>

        <div className="mt-8 space-y-3 border-t border-gray-200 pt-6 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-gray-50">Spending Progress</h3>
            <span className={`text-sm font-semibold ${isOverSpend ? "text-red-600" : "text-gray-600"}`}>
              {formatMoney(card.spend, card.currency)} / {formatMoney(card.limit, card.currency)}
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full rounded-full transition-all ${
                isOverSpend ? "bg-red-500" : spendPercent > 80 ? "bg-yellow-500" : "bg-blue-500"
              }`}
              style={{ width: `${Math.min(100, spendPercent)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500">
            {isOverSpend
              ? `Over limit by ${formatMoney(card.spend - card.limit, card.currency)}`
              : `${100 - spendPercent}% remaining`}
          </p>
        </div>
      </div>
      </div>
    </div>
  )
}
