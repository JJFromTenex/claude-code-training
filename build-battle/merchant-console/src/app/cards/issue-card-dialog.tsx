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
import { Card, CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

type MerchantOption = { id: string; name: string; currency: Currency }

type Issued = { card: Card; number: string }

/**
 * Issue a card from the console. The form posts to /api/cards, which does
 * the real validation; client checks here only save a round trip. On
 * success the full number is shown once, on this screen, and dropped from
 * state the moment the drawer closes — nothing else ever holds it.
 */
export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const ids = useId()
  const [open, setOpen] = useState(false)
  const [merchantId, setMerchantId] = useState("")
  const [nickname, setNickname] = useState("")
  const [category, setCategory] = useState<CardCategory>("any")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)

  const merchant = merchants.find((m) => m.id === merchantId)

  function reset() {
    setMerchantId("")
    setNickname("")
    setCategory("any")
    setLimit("")
    setCurrency("USD")
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    // Closing the success screen is the last time the number exists anywhere.
    if (!next) reset()
  }

  function chooseMerchant(id: string) {
    setMerchantId(id)
    const picked = merchants.find((m) => m.id === id)
    if (picked) setCurrency(picked.currency)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter the limit as an amount like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId, nickname, category, spendLimit, currency }),
      })
      const data: Partial<Issued> & { error?: string } = await res.json().catch(() => ({}))
      if (!res.ok || !data.card || !data.number) {
        setError(data.error ?? "The card was not issued. Try again.")
        return
      }
      setIssued({ card: data.card, number: data.number })
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const currencyMismatch =
    merchant && merchant.currency !== currency
      ? `${merchant.name} settles in ${merchant.currency}. Issuing in ${currency} is allowed, but check it is intended.`
      : null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="primary" className="w-full gap-2 py-1.5 sm:w-fit">
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
                Copy the number now. It is shown once and cannot be retrieved again; after this
                it appears everywhere as {maskCardNumber(issued.card.last4)}.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wide text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-xl tracking-widest text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="text-gray-900 dark:text-gray-50">{issued.card.nickname}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Merchant</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {merchants.find((m) => m.id === issued.card.merchantId)?.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.spendLimit, issued.card.currency)}{" "}
                    <span className="text-gray-500">{issued.card.currency}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {CARD_CATEGORY_LABELS[issued.card.category]}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Reference</dt>
                  <dd className="font-mono text-gray-900 dark:text-gray-50">{issued.card.numberRef}</dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="primary">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The card is active the moment it is created, with the limit you set here.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-merchant`} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={chooseMerchant} required>
                  <SelectTrigger id={`${ids}-merchant`} className="w-full">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-nickname`} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Nickname
                </label>
                <Input
                  id={`${ids}-nickname`}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Google Ads"
                  maxLength={60}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-limit`} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Spend limit
                  </label>
                  <Input
                    id={`${ids}-limit`}
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="250.00"
                    aria-describedby={`${ids}-limit-help`}
                    required
                  />
                  <p id={`${ids}-limit-help`} className="text-xs text-gray-500">
                    Up to {formatMoney(5_000_000, currency)}.
                  </p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${ids}-currency`} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Currency
                  </label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                    <SelectTrigger id={`${ids}-currency`} className="w-full">
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
                </div>
              </div>
              {currencyMismatch && (
                <p className="text-xs text-amber-700 dark:text-amber-400">{currencyMismatch}</p>
              )}

              <div className="flex flex-col gap-1.5">
                <label htmlFor={`${ids}-category`} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant category lock
                </label>
                <Select value={category} onValueChange={(v) => setCategory(v as CardCategory)}>
                  <SelectTrigger id={`${ids}-category`} className="w-full">
                    <SelectValue />
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

              {error && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-400">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" variant="primary" isLoading={submitting} loadingText="Issuing">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
