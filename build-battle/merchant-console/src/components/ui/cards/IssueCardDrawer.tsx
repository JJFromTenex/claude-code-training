"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
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
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS } from "@/data/cardCategories"
import { CardCategory, Currency } from "@/data/types"
import { maskCardNumber } from "@/lib/cardNumber"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

interface Merchant {
  id: string
  name: string
  currency: Currency
}

export function IssueCardDrawer({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory | "">("")
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [reveal, setReveal] = useState<{ number: string; last4: string } | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)

  const parsedLimit = parseAmountToMinorUnits(limitInput)

  function reset() {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("USD")
    setCategory("")
    setErrors({})
    setReveal(null)
    setCopyFailed(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})

    if (parsedLimit === null) {
      setErrors({ limit: "Enter a valid amount." })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit: parsedLimit,
          currency,
          category: category || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setErrors(data.fields ?? { form: data.error ?? "Could not issue the card." })
        return
      }

      setReveal({ number: data.number, last4: data.card.last4 })
      router.refresh()
    } catch {
      setErrors({ form: "Something went wrong reaching the server. Try again." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">Issue a card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {reveal ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">
                This is the only time the full number is shown. Copy it now — after
                you close this, it is masked everywhere as{" "}
                <span className="font-mono">{maskCardNumber(reveal.last4)}</span>.
              </p>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 font-mono text-lg tracking-wider text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
                {reveal.number}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setCopyFailed(false)
                  navigator.clipboard
                    ?.writeText(reveal.number)
                    .catch(() => setCopyFailed(true))
                }}
              >
                Copy number
              </Button>
              {copyFailed && (
                <p className="text-sm text-red-600 dark:text-red-500">
                  Couldn&apos;t copy automatically — select and copy the number above.
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Done
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              {errors.form && (
                <p className="text-sm text-red-600 dark:text-red-500">{errors.form}</p>
              )}

              <div>
                <label htmlFor="card-nickname" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  className="mt-1"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend — Meta"
                  required
                />
                {errors.nickname && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">{errors.nickname}</p>
                )}
              </div>

              <div>
                <label htmlFor="card-merchant" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(id) => {
                    setMerchantId(id)
                    const merchant = merchants.find((m) => m.id === id)
                    if (merchant) setCurrency(merchant.currency)
                  }}
                >
                  <SelectTrigger id="card-merchant" className="mt-1">
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
                {errors.merchantId && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">{errors.merchantId}</p>
                )}
              </div>

              <div>
                <label htmlFor="card-limit" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Spend limit
                </label>
                <Input
                  id="card-limit"
                  className="mt-1"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="250.00"
                  required
                />
                {limitInput && parsedLimit !== null && (
                  <p className="mt-1 text-sm text-gray-500">
                    {formatMoney(parsedLimit, currency)}
                  </p>
                )}
                {errors.limit && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">{errors.limit}</p>
                )}
              </div>

              <div>
                <label htmlFor="card-currency" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Currency
                </label>
                <Select value={currency} onValueChange={(c) => setCurrency(c as Currency)}>
                  <SelectTrigger id="card-currency" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.currency && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">{errors.currency}</p>
                )}
              </div>

              <div>
                <label htmlFor="card-category" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Category
                </label>
                <Select
                  value={category}
                  onValueChange={(c) => setCategory(c as CardCategory)}
                >
                  <SelectTrigger id="card-category" className="mt-1">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CARD_CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
