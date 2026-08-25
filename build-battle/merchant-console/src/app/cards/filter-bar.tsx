"use client"

import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { useRouter } from "next/navigation"
import { useState } from "react"

const LABELS: Record<string, string> = {
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
  statuses: readonly string[]
  merchants: { id: string; name: string }[]
  current: { status: string; merchantId: string; search: string }
}) {
  const router = useRouter()
  const [search, setSearch] = useState(current.search)

  const apply = (changes: Record<string, string>) => {
    const next = new URLSearchParams()
    const merged = { ...current, ...changes }
    if (merged.status && merged.status !== "all") next.set("status", merged.status)
    if (merged.merchantId) next.set("merchantId", merged.merchantId)
    if (merged.search) next.set("search", merged.search)
    router.push(`/cards?${next.toString()}`)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply({ search })
        }}
      >
        <label htmlFor="cards-search" className="sr-only">
          Search cards
        </label>
        <Input
          id="cards-search"
          type="search"
          name="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search cards..."
          className="sm:w-64 [&>input]:py-1.5"
        />
      </form>

      <Select
        value={current.status || "all"}
        onValueChange={(status) => apply({ status })}
      >
        <SelectTrigger className="w-full py-1.5 sm:w-40" aria-label="Filter by status">
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

      <Select
        value={current.merchantId || "all"}
        onValueChange={(merchantId) =>
          apply({ merchantId: merchantId === "all" ? "" : merchantId })
        }
      >
        <SelectTrigger className="w-full py-1.5 sm:w-52" aria-label="Filter by merchant">
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
