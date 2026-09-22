"use client"

import { Button } from "@/components/Button"
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
  captured: "Captured",
  authorized: "Authorized",
  refunded: "Refunded",
  disputed: "Disputed",
  failed: "Failed",
}

const METHOD_LABELS: Record<string, string> = {
  all: "All methods",
  card: "Card",
  wallet: "Wallet",
  bank_transfer: "Bank transfer",
}

const BRAND_LABELS: Record<string, string> = {
  all: "All brands",
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
}

export interface PaymentsFilterValues {
  status: string
  merchantId: string
  search: string
  method: string
  cardBrand: string
  currency: string
  minAmount: string
  maxAmount: string
  from: string
  to: string
  sort: string
  direction: string
}

export function PaymentsFilterBar({
  statuses,
  methods,
  cardBrands,
  currencies,
  merchants,
  current,
}: {
  statuses: string[]
  methods: string[]
  cardBrands: string[]
  currencies: string[]
  merchants: { id: string; name: string }[]
  current: PaymentsFilterValues
}) {
  const router = useRouter()
  const [search, setSearch] = useState(current.search)
  const [minAmount, setMinAmount] = useState(current.minAmount)
  const [maxAmount, setMaxAmount] = useState(current.maxAmount)

  const brandEnabled = current.method === "card"
  const amountEnabled = Boolean(current.currency)

  const apply = (changes: Partial<PaymentsFilterValues>) => {
    const merged = { ...current, ...changes }
    const next = new URLSearchParams()

    if (merged.status && merged.status !== "all") next.set("status", merged.status)
    if (merged.merchantId) next.set("merchantId", merged.merchantId)
    if (merged.search) next.set("search", merged.search)
    if (merged.method && merged.method !== "all") next.set("method", merged.method)
    if (merged.method === "card" && merged.cardBrand && merged.cardBrand !== "all") {
      next.set("cardBrand", merged.cardBrand)
    }
    if (merged.currency) {
      next.set("currency", merged.currency)
      if (merged.minAmount) next.set("minAmount", merged.minAmount)
      if (merged.maxAmount) next.set("maxAmount", merged.maxAmount)
    }
    if (merged.from) next.set("from", merged.from)
    if (merged.to) next.set("to", merged.to)

    // The sort survives a filter change; only the page resets.
    if (merged.sort && merged.sort !== "createdAt") next.set("sort", merged.sort)
    if (merged.direction && merged.direction !== "desc") {
      next.set("direction", merged.direction)
    }

    router.push(`/payments?${next.toString()}`)
  }

  const isFiltered =
    current.status !== "all" ||
    Boolean(current.merchantId) ||
    Boolean(current.search) ||
    current.method !== "all" ||
    Boolean(current.currency)

  const clearAll = () => {
    setSearch("")
    setMinAmount("")
    setMaxAmount("")
    router.push("/payments")
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          apply({ search })
        }}
      >
        <Input
          type="search"
          name="search"
          aria-label="Search payments"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search payments..."
          className="sm:w-56 [&>input]:py-1.5"
        />
      </form>

      <Select
        value={current.status || "all"}
        onValueChange={(status) => apply({ status })}
      >
        <SelectTrigger aria-label="Status" className="w-full py-1.5 sm:w-36">
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
        <SelectTrigger aria-label="Merchant" className="w-full py-1.5 sm:w-48">
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

      <Select
        value={current.method || "all"}
        onValueChange={(method) =>
          // Leaving card clears the brand, which is meaningless off card.
          apply({ method, cardBrand: method === "card" ? current.cardBrand : "all" })
        }
      >
        <SelectTrigger aria-label="Payment method" className="w-full py-1.5 sm:w-40">
          <SelectValue placeholder="All methods" />
        </SelectTrigger>
        <SelectContent align="end">
          {methods.map((method) => (
            <SelectItem key={method} value={method}>
              {METHOD_LABELS[method] ?? method}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.cardBrand || "all"}
        disabled={!brandEnabled}
        onValueChange={(cardBrand) => apply({ cardBrand })}
      >
        <SelectTrigger
          aria-label="Card brand"
          className="w-full py-1.5 sm:w-36"
          title={brandEnabled ? undefined : "Select the Card method first"}
        >
          <SelectValue placeholder="All brands" />
        </SelectTrigger>
        <SelectContent align="end">
          {cardBrands.map((brand) => (
            <SelectItem key={brand} value={brand}>
              {BRAND_LABELS[brand] ?? brand}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={current.currency || "all"}
        onValueChange={(currency) => {
          const next = currency === "all" ? "" : currency
          if (!next) {
            setMinAmount("")
            setMaxAmount("")
          }
          apply({ currency: next, minAmount: next ? minAmount : "", maxAmount: next ? maxAmount : "" })
        }}
      >
        <SelectTrigger aria-label="Currency" className="w-full py-1.5 sm:w-36">
          <SelectValue placeholder="All currencies" />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="all">All currencies</SelectItem>
          {currencies.map((currency) => (
            <SelectItem key={currency} value={currency}>
              {currency}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          apply({ minAmount, maxAmount })
        }}
      >
        <Input
          name="minAmount"
          inputMode="decimal"
          aria-label="Minimum amount"
          disabled={!amountEnabled}
          value={minAmount}
          onChange={(event) => setMinAmount(event.target.value)}
          onBlur={() => apply({ minAmount, maxAmount })}
          placeholder="Min"
          title={amountEnabled ? undefined : "Pick a currency to filter by amount"}
          className="w-24 [&>input]:py-1.5"
        />
        <span className="text-sm text-gray-400" aria-hidden="true">
          –
        </span>
        <Input
          name="maxAmount"
          inputMode="decimal"
          aria-label="Maximum amount"
          disabled={!amountEnabled}
          value={maxAmount}
          onChange={(event) => setMaxAmount(event.target.value)}
          onBlur={() => apply({ minAmount, maxAmount })}
          placeholder="Max"
          title={amountEnabled ? undefined : "Pick a currency to filter by amount"}
          className="w-24 [&>input]:py-1.5"
        />
      </form>

      {isFiltered && (
        <Button variant="ghost" className="py-1.5" onClick={clearAll}>
          Clear all
        </Button>
      )}
    </div>
  )
}
