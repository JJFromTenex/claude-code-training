"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { useRouter } from "next/navigation"

const STATUS_LABELS: Record<string, string> = {
  all: "All statuses",
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

export function CardsFilterBar({
  statuses,
  merchants,
  current,
}: {
  statuses: string[]
  merchants: { id: string; name: string }[]
  current: { status: string; merchantId: string }
}) {
  const router = useRouter()

  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams()
    const merged = { ...current, ...changes }
    if (merged.status && merged.status !== "all") next.set("status", merged.status)
    if (merged.merchantId) next.set("merchantId", merged.merchantId)
    const query = next.toString()
    router.push(query ? `/cards?${query}` : "/cards")
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Select
        value={current.status || "all"}
        onValueChange={(status) => apply({ status })}
      >
        <SelectTrigger className="w-full py-1.5 sm:w-40">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent align="end">
          {statuses.map((status) => (
            <SelectItem key={status} value={status}>
              {STATUS_LABELS[status] ?? status}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.merchantId || "all"}
        onValueChange={(merchantId) =>
          apply({ merchantId: merchantId === "all" ? "" : merchantId })
        }
      >
        <SelectTrigger className="w-full py-1.5 sm:w-52">
          <SelectValue placeholder="All merchants" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="all">All merchants</SelectItem>
          {merchants.map((merchant) => (
            <SelectItem key={merchant.id} value={merchant.id}>
              {merchant.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
