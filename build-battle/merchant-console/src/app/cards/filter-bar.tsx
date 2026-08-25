"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { useRouter } from "next/navigation"

const LABELS: Record<string, string> = {
  all: "All statuses",
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

/** Status filter for `/cards`, mirroring the payments filter bar's pattern. */
export function CardsFilterBar({
  statuses,
  current,
}: {
  statuses: string[]
  current: { status: string; merchantId: string }
}) {
  const router = useRouter()

  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams()
    const merged = { ...current, ...changes }
    if (merged.status && merged.status !== "all") next.set("status", merged.status)
    if (merged.merchantId) next.set("merchantId", merged.merchantId)
    router.push(`/cards?${next.toString()}`)
  }

  return (
    <Select value={current.status || "all"} onValueChange={(status) => apply({ status })}>
      <SelectTrigger aria-label="Filter by status" className="w-full py-1.5 sm:w-40">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent align="end">
        {statuses.map((status) => (
          <SelectItem key={status} value={status}>
            {LABELS[status] ?? status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
