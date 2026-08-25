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
import { CardCategory, Currency } from "@/data/types"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORY_LABELS: Record<CardCategory | "none", string> = {
  none: "No category lock",
  ads: "Advertising",
  saas: "Software & SaaS",
  travel: "Travel",
  office: "Office & supplies",
  other: "Other",
}

/**
 * The issue form. The number itself is generated on the server; this form
 * only sends the request and shows the creation response — the one and only
 * time the full number is visible. Closing the drawer clears it from state.
 */
export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [spendLimit, setSpendLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory | "none">("none")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{
    nickname: string
    fullNumber: string
    last4: string
  } | null>(null)

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Reveal once: the full number does not survive the drawer closing.
      setIssued(null)
      setError(null)
      setNickname("")
      setMerchantId("")
      setSpendLimit("")
      setCurrency("USD")
      setCategory("none")
    }
  }

  function pickMerchant(id: string) {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          categoryLock: category === "none" ? null : category,
        }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.message ?? "Something went wrong issuing the card.")
        return
      }
      setIssued({
        nickname: data.card.nickname,
        fullNumber: data.fullNumber,
        last4: data.card.last4,
      })
      router.refresh()
    } catch {
      setError("The request failed. Check the dev server and try again.")
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
      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                “{issued.nickname}” is active and in the list.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="text-sm text-gray-500">Card number</p>
              <p className="mt-1 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                {issued.fullNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}
              </p>
              <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-400">
                This is the only time the full number is shown. Everywhere
                else it appears as •••• {issued.last4}.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="w-full sm:w-fit">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, with a limit from the moment
                it exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
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
                  className="mt-1"
                  placeholder="e.g. Search ad spend"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={pickMerchant}>
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
              </div>
              <div className="grid grid-cols-2 gap-4">
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
                    className="mt-1"
                    placeholder="250.00"
                    inputMode="decimal"
                    value={spendLimit}
                    onChange={(event) => setSpendLimit(event.target.value)}
                    required
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
                    <SelectTrigger id="card-currency" className="mt-1">
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
                  onValueChange={(value) =>
                    setCategory(value as CardCategory | "none")
                  }
                >
                  <SelectTrigger id="card-category" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CATEGORY_LABELS) as (CardCategory | "none")[]).map(
                      (key) => (
                        <SelectItem key={key} value={key}>
                          {CATEGORY_LABELS[key]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-gray-500">
                  Optional. Locks the card to one merchant category at issue
                  time.
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
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button" className="w-full sm:w-fit">
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                className="w-full sm:w-fit"
                disabled={submitting}
              >
                {submitting ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
