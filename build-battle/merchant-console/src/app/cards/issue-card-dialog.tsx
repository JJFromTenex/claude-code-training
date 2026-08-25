"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
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
import { Card, CardCategory, Currency } from "@/data/types"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORY_LABELS: Record<CardCategory | "none", string> = {
  none: "No category lock",
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  professional_services: "Professional services",
}

type Issued = { card: Card; number: string }

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory | "none">("none")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // The full number lives here and nowhere else, only until the drawer closes.
  const [issued, setIssued] = useState<Issued | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("none")
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const pickMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter the spend limit as an amount like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          categoryLock: category === "none" ? null : category,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "The card could not be issued.")
        return
      }
      setIssued(payload)
      router.refresh()
    } catch {
      setError("The card could not be issued. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={close}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                everywhere else it appears as •••• {issued.card.last4}.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500">{issued.card.nickname}</p>
                <p className="mt-1 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Limit{" "}
                  {formatMoney(issued.card.spendLimit, issued.card.currency)} ·{" "}
                  {issued.card.currency}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                The card is active immediately and appears in the list.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, always virtual, limited from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-900 dark:text-gray-50">
                Nickname
                <Input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend — Q3"
                  required
                />
              </label>

              <label
                id="issue-merchant-label"
                className="flex flex-col gap-1 text-sm font-medium text-gray-900 dark:text-gray-50"
              >
                Merchant
                <Select value={merchantId} onValueChange={pickMerchant}>
                  <SelectTrigger aria-labelledby="issue-merchant-label">
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
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1 text-sm font-medium text-gray-900 dark:text-gray-50">
                  Spend limit
                  <Input
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="2500.00"
                    inputMode="decimal"
                    required
                  />
                </label>
                <label
                  id="issue-currency-label"
                  className="flex flex-col gap-1 text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Currency
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger aria-labelledby="issue-currency-label">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <label
                id="issue-category-label"
                className="flex flex-col gap-1 text-sm font-medium text-gray-900 dark:text-gray-50"
              >
                Merchant category lock
                <Select
                  value={category}
                  onValueChange={(value) =>
                    setCategory(value as CardCategory | "none")
                  }
                >
                  <SelectTrigger aria-labelledby="issue-category-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as (CardCategory | "none")[]).map(
                      (value) => (
                        <SelectItem key={value} value={value}>
                          {CATEGORY_LABELS[value]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </label>

              {error && (
                <p
                  className="text-sm text-red-600 dark:text-red-400"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
