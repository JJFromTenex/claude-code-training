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
import { CardCategory, Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Every check here is for immediate feedback. `POST /api/cards` re-validates
 * all of it, because the client is not trusted.
 */

const MAX_SPEND_LIMIT = 5_000_000

export function IssueCardDrawer({
  merchants,
  currencies,
  categories,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
  currencies: readonly Currency[]
  categories: readonly CardCategory[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{
    nickname: string
    last4: string
    fullNumber: string
  } | null>(null)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory>("software")

  // Closing discards the revealed number. It is not recoverable, by design.
  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("software")
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      reset()
      router.refresh()
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!nickname.trim()) return setError("Give the card a nickname.")
    if (!merchantId) return setError("Choose a merchant.")

    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      return setError("Enter the limit as an amount, like 250 or 250.00.")
    }
    if (spendLimit <= 0) return setError("Spend limit must be greater than zero.")
    if (spendLimit > MAX_SPEND_LIMIT) {
      return setError("Spend limit cannot exceed 5,000,000 minor units.")
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit,
          currency,
          category,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        setError(body.error ?? "Could not issue the card. Try again.")
        return
      }

      setIssued({
        nickname: body.card.nickname,
        last4: body.card.last4,
        fullNumber: body.fullNumber,
      })
    } catch {
      setError("Could not reach the server. Check your connection and retry.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">Issue card</Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                {issued.nickname} is active and ready to use.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-50">
                Card number
              </p>
              <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-4 font-mono text-lg tabular-nums text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
                {issued.fullNumber}
              </p>
              <p className="mt-3 text-sm text-amber-600 dark:text-amber-500">
                This is the only time the full number is shown. Copy it now —
                everywhere else it appears as •••• {issued.last4}.
              </p>
            </DrawerBody>

            <DrawerFooter>
              <Button
                variant="secondary"
                className="w-full sm:w-fit"
                onClick={() => navigator.clipboard?.writeText(issued.fullNumber)}
              >
                Copy number
              </Button>
              <Button
                className="w-full sm:w-fit"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, limited from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Figma — design team"
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="merchant" className="mt-2">
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

              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="limit"
                    name="limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="250.00"
                    className="mt-2"
                  />
                </div>

                <div className="w-32">
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger id="currency" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id="category" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((option) => (
                      <SelectItem
                        key={option}
                        value={option}
                        className="capitalize"
                      >
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-sm text-gray-500">
                  The card is locked to this category and cannot be changed
                  after issue.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-fit"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                className="w-full sm:w-fit"
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
