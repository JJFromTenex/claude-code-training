"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { merchants } from "@/data/merchants"
import { Currency, MerchantCategory } from "@/data/types"
import { maskCardNumber, last4Of } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORIES: { value: MerchantCategory; label: string }[] = [
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software" },
  { value: "shipping", label: "Shipping" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "travel", label: "Travel" },
]

type CreatedCard = {
  nickname: string
  fullNumber: string
  spendLimit: number
  currency: Currency
}

const initialForm = {
  nickname: "",
  merchantId: "",
  amount: "",
  currency: "USD" as Currency,
  categoryLock: "" as MerchantCategory | "",
}

export function IssueCardDrawer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedCard | null>(null)

  const reset = () => {
    setForm(initialForm)
    setError(null)
    setCreated(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Reveal is over the moment the drawer closes; nothing lingers in state.
      reset()
      if (created) router.refresh()
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const spendLimit = parseAmountToMinorUnits(form.amount)
    if (spendLimit === null) {
      setError("Enter a valid spend limit, e.g. 250.00.")
      return
    }
    if (!form.merchantId) {
      setError("Choose a merchant.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit,
          currency: form.currency,
          categoryLock: form.categoryLock || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.message ?? "Could not issue the card.")
        return
      }
      setCreated({
        nickname: form.nickname,
        fullNumber: data.fullNumber,
        spendLimit,
        currency: form.currency,
      })
      router.refresh()
    } catch {
      setError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button>Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {created ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm text-gray-500">{created.nickname}</p>
                <p className="mt-1 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {created.fullNumber}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Limit {formatMoney(created.spendLimit, created.currency)}
                </p>
              </div>
              <p className="text-sm text-amber-600 dark:text-amber-500">
                Copy this number now. After you close this panel it will only
                ever show as {maskCardNumber(last4Of(created.fullNumber))}.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-900 dark:bg-red-400/10 dark:text-red-400"
                >
                  {error}
                </p>
              )}
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  required
                  className="mt-1"
                  placeholder="Ad spend — Halcyon Studio"
                  value={form.nickname}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nickname: e.target.value }))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) =>
                    setForm((f) => ({ ...f, merchantId }))
                  }
                >
                  <SelectTrigger id="card-merchant" aria-label="Merchant" className="mt-1">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="card-amount"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-amount"
                    required
                    inputMode="decimal"
                    className="mt-1"
                    placeholder="250.00"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, amount: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={form.currency}
                    onValueChange={(currency) =>
                      setForm((f) => ({ ...f, currency: currency as Currency }))
                    }
                  >
                    <SelectTrigger id="card-currency" aria-label="Currency" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">
                    (optional)
                  </span>
                </label>
                <Select
                  value={form.categoryLock}
                  onValueChange={(categoryLock) =>
                    setForm((f) => ({
                      ...f,
                      categoryLock: categoryLock as MerchantCategory,
                    }))
                  }
                >
                  <SelectTrigger id="card-category" aria-label="Category lock" className="mt-1">
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" isLoading={submitting} loadingText="Issuing…">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
