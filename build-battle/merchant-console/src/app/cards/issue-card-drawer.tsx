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
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

export function IssueCardDrawer({
  merchants,
  categories,
}: {
  merchants: { id: string; name: string }[]
  categories: CardCategory[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory>("advertising")

  // The full number lives here and nowhere else, and only until the success
  // screen closes.
  const [revealed, setRevealed] = useState<string | null>(null)
  const [issuedNickname, setIssuedNickname] = useState("")

  function reset() {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("advertising")
    setError(null)
    setRevealed(null)
    setIssuedNickname("")
  }

  function close() {
    setOpen(false)
    reset()
    router.refresh()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit,
          currency,
          category,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.message ?? "That card could not be issued.")
        return
      }

      setIssuedNickname(data.card.nickname)
      setRevealed(data.number)
      router.refresh()
    } catch {
      setError("The console could not reach the server. Try again.")
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
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {revealed ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                {issuedNickname} is active and ready to use.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <div aria-live="polite">
                <p className="text-sm text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-lg tracking-widest text-gray-900 dark:text-gray-50">
                  {revealed}
                </p>
                <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  This is the only time this number is shown. Copy it now — the
                  console keeps only the last four.
                </p>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={close}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The number is generated when you submit and shown once.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="card-nickname"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Nickname
                  </label>
                  <Input
                    id="card-nickname"
                    name="nickname"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="Meta Ads"
                    className="mt-2"
                  />
                </div>

                <div>
                  <label
                    htmlFor="card-merchant"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Merchant
                  </label>
                  <Select value={merchantId} onValueChange={setMerchantId}>
                    <SelectTrigger id="card-merchant" className="mt-2">
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

                <div>
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    name="limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="250.00"
                    className="mt-2"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Amount in {currency}, for example 250.00
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger id="card-currency" className="mt-2">
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
                </div>

                <div>
                  <label
                    htmlFor="card-category"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Category
                  </label>
                  <Select
                    value={category}
                    onValueChange={(value) =>
                      setCategory(value as CardCategory)
                    }
                  >
                    <SelectTrigger id="card-category" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((value) => (
                        <SelectItem key={value} value={value}>
                          {CATEGORY_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-sm text-gray-500">
                    The card is locked to this category.
                  </p>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
                  >
                    {error}
                  </p>
                )}
              </div>
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting}>
                {submitting ? "Issuing" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
