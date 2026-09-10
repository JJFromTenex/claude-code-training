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
import {
  CARD_CATEGORIES,
  CardCategory,
  Currency,
  CURRENCIES,
  MAX_SPEND_LIMIT,
} from "@/data/types"
import { CARD_CATEGORY_LABELS, maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Issued = {
  nickname: string
  last4: string
  number: string | null
  replayed: boolean
}

const labelClass =
  "block text-sm font-medium text-gray-900 dark:text-gray-50"

/** Groups a 16 digit number into fours for the one-time reveal. */
function groupInFours(value: string): string {
  return value.replace(/(.{4})/g, "$1 ").trim()
}

export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState("")

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [limitInput, setLimitInput] = useState("")
  const [categoryLock, setCategoryLock] = useState<CardCategory | "none">("none")

  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copyNote, setCopyNote] = useState<string | null>(null)

  const merchant = merchants.find((m) => m.id === merchantId)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setCurrency("USD")
    setLimitInput("")
    setCategoryLock("none")
    setError(null)
    setSubmitting(false)
    setIssued(null)
    setCopyNote(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    reset()
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const spendLimit = parseAmountToMinorUnits(limitInput)
    if (spendLimit === null) {
      setError("Enter an amount like 250.00")
      return
    }
    if (spendLimit > MAX_SPEND_LIMIT) {
      setError(
        `The most this console will issue is ${formatMoney(MAX_SPEND_LIMIT, currency)}.`,
      )
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
          spendLimit,
          currency,
          categoryLock: categoryLock === "none" ? null : categoryLock,
          idempotencyKey,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? "The card could not be issued.")
        return
      }
      setIssued({
        nickname: body.card.nickname,
        last4: body.card.last4,
        number: body.number ?? null,
        replayed: Boolean(body.replayed),
      })
      router.refresh()
    } catch {
      setError("Could not reach the console. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async () => {
    if (!issued?.number || !navigator.clipboard) {
      setCopyNote("Copying is not available here. Select the number instead.")
      return
    }
    try {
      await navigator.clipboard.writeText(issued.number)
      setCopyNote("Copied to the clipboard.")
    } catch {
      setCopyNote("Copying is not available here. Select the number instead.")
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Issue a virtual card</DrawerTitle>
          <DrawerDescription className="text-sm">
            Single-merchant, always virtual, and limited from the moment it
            exists.
          </DrawerDescription>
        </DrawerHeader>

        {issued ? (
          <>
            <DrawerBody className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                {issued.replayed ? "This card was already issued" : "Card issued"}
              </h2>
              {issued.number ? (
                <>
                  <p className="font-mono text-2xl tracking-widest text-gray-900 dark:text-gray-50">
                    {groupInFours(issued.number)}
                  </p>
                  <p className="text-sm text-gray-500">
                    This is the only time the full number is shown. Copy it now.
                  </p>
                  <Button variant="secondary" onClick={copy} className="py-1.5">
                    Copy number
                  </Button>
                  {copyNote && (
                    <p className="text-sm text-gray-500" role="status">
                      {copyNote}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  That request was already processed, so the full number is not
                  shown again.
                </p>
              )}
              <dl className="space-y-1 border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {issued.nickname}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-gray-500">Number</dt>
                  <dd className="font-mono text-gray-900 dark:text-gray-50">
                    {maskCardNumber(issued.last4)}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerBody className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="card-nickname" className={labelClass}>
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  required
                  maxLength={40}
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="card-merchant" className={labelClass}>
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(id) => {
                    setMerchantId(id)
                    const picked = merchants.find((m) => m.id === id)
                    if (picked) setCurrency(picked.currency)
                  }}
                >
                  <SelectTrigger id="card-merchant" className="w-full py-1.5">
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

              <div className="space-y-2">
                <label htmlFor="card-currency" className={labelClass}>
                  Currency
                </label>
                <Select
                  value={currency}
                  onValueChange={(value) => setCurrency(value as Currency)}
                >
                  <SelectTrigger id="card-currency" className="w-full py-1.5">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {merchant && (
                  <p className="text-sm text-gray-500">
                    {merchant.name} settles in {merchant.currency}.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="card-limit" className={labelClass}>
                  Spend limit
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    id="card-limit"
                    name="spendLimit"
                    type="text"
                    inputMode="decimal"
                    required
                    value={limitInput}
                    onChange={(event) => setLimitInput(event.target.value)}
                    placeholder="250.00"
                  />
                  <span className="text-sm text-gray-500">{currency}</span>
                </div>
                <p className="text-sm text-gray-500">
                  Up to {formatMoney(MAX_SPEND_LIMIT, currency)}.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="card-category" className={labelClass}>
                  Category lock
                </label>
                <Select
                  value={categoryLock}
                  onValueChange={(value) =>
                    setCategoryLock(value as CardCategory | "none")
                  }
                >
                  <SelectTrigger id="card-category" className="w-full py-1.5">
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category lock</SelectItem>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CARD_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} isLoading={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
