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
import { CARD_CATEGORIES, CURRENCIES, maskCard } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  any: "Any category",
  advertising: "Advertising",
  software: "Software",
  contractors: "Contractors",
  travel: "Travel",
}

type Issued = { last4: string; fullNumber: string; nickname: string }

/**
 * Issue a card, then reveal its number exactly once.
 *
 * The number lives in component state only until the drawer closes, and is
 * cleared on close — it is never written anywhere it could be read back.
 * The number itself is generated on the server; nothing here invents one.
 */
export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory>("any")

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("any")
    setError(null)
    setIssued(null)
    setSaving(false)
  }

  const close = (next: boolean) => {
    setOpen(next)
    // Clearing on close is what makes the reveal one-time.
    if (!next) reset()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // Money crosses the boundary here, once, into integer minor units.
    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Spend limit must be an amount like 250 or 250.00.")
      return
    }

    setSaving(true)
    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nickname,
        merchantId,
        spendLimit,
        currency,
        category,
      }),
    })
    setSaving(false)

    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(body.message ?? "Could not issue the card.")
      return
    }

    setIssued({
      last4: body.card.last4,
      fullNumber: body.fullNumber,
      nickname: body.card.nickname,
    })
    router.refresh()
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
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm text-gray-500">{issued.nickname}</p>
                <p className="mt-2 font-mono text-xl tracking-wider text-gray-900 dark:text-gray-50">
                  {issued.fullNumber.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Everywhere else in the console this card appears as{" "}
                <span className="font-mono">{maskCard(issued.last4)}</span>.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, with a spend limit from the moment it exists.
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
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Meta ad spend"
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
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="2500.00"
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
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  className="text-sm text-red-600 dark:text-red-500"
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
              <Button type="submit" isLoading={saving} loadingText="Issuing…">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
