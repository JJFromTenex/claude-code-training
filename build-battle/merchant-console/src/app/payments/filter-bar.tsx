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
import { PaymentsPageFilters, paymentsQuery } from "./query"

const LABELS: Record<string, string> = {
  all: "All statuses",
  captured: "Captured",
  authorized: "Authorized",
  refunded: "Refunded",
  disputed: "Disputed",
  failed: "Failed",
}

export function PaymentsFilterBar({
  statuses,
  merchants,
  current,
}: {
  statuses: string[]
  merchants: { id: string; name: string }[]
  current: PaymentsPageFilters
}) {
  const router = useRouter()
  const [search, setSearch] = useState(current.search)

  const apply = (changes: Partial<PaymentsPageFilters>) => {
    const next = paymentsQuery({ ...current, ...changes })
    router.push(`/payments?${next.toString()}`)
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply({ search })
        }}
      >
        <Input
          type="search"
          name="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search payments..."
          className="sm:w-64 [&>input]:py-1.5"
        />
      </form>

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
