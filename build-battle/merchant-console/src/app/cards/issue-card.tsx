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
import { Card, Currency } from "@/data/types"
import { CARD_CATEGORIES, MAX_SPEND_LIMIT, maskCard } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORY_LABELS: Record<string, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  office: "Office",
}

export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState("none")

  const [error, setError] = useState<string | null>(null)
  const [limitError, setLimitError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<{
    card: Card
    fullNumber: string
  } | null>(null)

  function reset() {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("USD")
    setCategory("none")
    setError(null)
    setLimitError(false)
    setSubmitting(false)
    // The full number must not outlive the success screen.
    setCreated(null)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  function handleMerchantChange(id: string) {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setLimitError(false)

    if (!merchantId) {
      setError("Choose a merchant.")
      return
    }
    const spendLimit = parseAmountToMinorUnits(limitInput)
    if (spendLimit === null || spendLimit <= 0) {
      setLimitError(true)
      setError("Enter a positive spend limit, like 250.00.")
      return
    }
    if (spendLimit > MAX_SPEND_LIMIT) {
      setLimitError(true)
      setError(
        `Spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, currency)}.`,
      )
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantId,
          nickname,
          spendLimit,
          currency,
          categoryLock: category === "none" ? null : category,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error ?? "Something went wrong. Try again.")
        return
      }
      const body = (await res.json()) as { card: Card; fullNumber: string }
      setCreated(body)
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {created ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription className="mt-1">
                {created.card.nickname} is active and ready to use.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="text-sm text-gray-500">Card number</p>
              <p className="mt-1 font-mono text-xl tracking-wide text-gray-900 dark:text-gray-50">
                {created.fullNumber.replace(/(.{4})/g, "$1 ").trim()}
              </p>
              <p className="mt-4 text-sm font-medium text-amber-600 dark:text-amber-500">
                This number is shown once. Copy it now — after this screen it
                appears only as {maskCard(created.card.last4)}.
              </p>
              <p className="mt-4 text-sm text-gray-500">
                Spend limit{" "}
                {formatMoney(created.card.spendLimit, created.card.currency)} ·{" "}
                {created.card.currency}
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue virtual card</DrawerTitle>
              <DrawerDescription className="mt-1">
                Single-merchant virtual card with a spend limit.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
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
                  placeholder="Vendor subscriptions"
                  maxLength={40}
                  required
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
                <Select value={merchantId} onValueChange={handleMerchantChange}>
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
                  name="spendLimit"
                  inputMode="decimal"
                  value={limitInput}
                  onChange={(event) => setLimitInput(event.target.value)}
                  placeholder="250.00"
                  hasError={limitError}
                  required
                  className="mt-2"
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
                <p className="mt-1 text-xs text-gray-500">
                  Defaults to the merchant&apos;s settlement currency.
                </p>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lock</SelectItem>
                    {CARD_CATEGORIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {CATEGORY_LABELS[code] ?? code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" isLoading={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
