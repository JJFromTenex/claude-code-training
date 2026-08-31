"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { Card, CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS, maskNumber } from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { Check, CirclePlus, Copy } from "lucide-react"
import { useRouter } from "next/navigation"
import { FormEvent, useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

interface CreateCardResponse {
  card: Card
  number: string | null
  duplicate: boolean
}

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
  const [currencyTouched, setCurrencyTouched] = useState(false)
  const [category, setCategory] = useState<CardCategory | "">("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CreateCardResponse | null>(null)
  const [copied, setCopied] = useState(false)
  // One key per issue attempt in this dialog session. A retried submit (the
  // user clicking again after a dropped response) reuses it on purpose, so
  // the server can tell "same request again" from "a second card" — see
  // src/data/cards.ts's createCard(). A fresh session gets a fresh key.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCurrencyTouched(false)
    setCategory("")
    setError(null)
    setSubmitting(false)
    setResult(null)
    setCopied(false)
    setIdempotencyKey(crypto.randomUUID())
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      const created = result !== null && !result.duplicate
      reset()
      if (created) router.refresh()
    }
  }

  const selectMerchant = (id: string) => {
    setMerchantId(id)
    if (!currencyTouched) {
      const merchant = merchants.find((m) => m.id === id)
      if (merchant) setCurrency(merchant.currency)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit,
          currency,
          category: category || undefined,
          idempotencyKey,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.error ?? "Something went wrong. Try again.")
        return
      }
      setResult(body)
    } catch {
      setError("Couldn't reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const copyNumber = async () => {
    if (!result?.number) return
    try {
      await navigator.clipboard.writeText(result.number)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access denied — the number is still on screen to copy by hand.
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary" className="w-full gap-2 py-1.5 sm:w-fit">
          <CirclePlus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DialogTrigger>
      <DialogContent>
        {!result ? (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Issue a card</DialogTitle>
              <DialogDescription>
                Generated on the test BIN. The full number shows once, right after this.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend - Q3"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={selectMerchant}>
                  <SelectTrigger id="card-merchant" className="py-1.5">
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
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    type="text"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="250.00"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => {
                      setCurrency(value as Currency)
                      setCurrencyTouched(true)
                    }}
                  >
                    <SelectTrigger id="card-currency" className="py-1.5">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!currencyTouched && merchantId && (
                <p className="-mt-2 text-xs text-gray-500">
                  Defaulted to this merchant&rsquo;s currency — change it above if this card
                  should be issued in a different one.
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant category lock{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id="card-category" className="py-1.5">
                    <SelectValue placeholder="No lock — any category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CARD_CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-500" role="alert">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary" className="py-1.5" type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                variant="primary"
                className="py-1.5"
                type="submit"
                isLoading={submitting}
                loadingText="Issuing…"
                disabled={!nickname.trim() || !merchantId || !limit}
              >
                Issue card
              </Button>
            </DialogFooter>
          </form>
        ) : result.duplicate ? (
          <>
            <DialogHeader>
              <DialogTitle>Already issued</DialogTitle>
              <DialogDescription>
                This request already went through — a duplicate submit doesn&rsquo;t create a
                second card. The number was only ever shown the first time.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {result.card.nickname}
                </p>
                <p className="mt-1 font-mono text-lg text-gray-900 dark:text-gray-50">
                  {maskNumber(result.card.last4)}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {formatMoney(result.card.limit, result.card.currency)} limit
                </p>
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="primary" className="py-1.5" type="button">
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Card issued</DialogTitle>
              <DialogDescription>
                This is the only time the full number is shown. After you close this, it
                reads <span className="font-mono">{maskNumber(result.card.last4)}</span>{" "}
                everywhere.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {result.card.nickname}
                </p>
                <p className="mt-1 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {result.number?.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {formatMoney(result.card.limit, result.card.currency)} limit
                </p>
              </div>
              <Button
                variant="secondary"
                className="w-full gap-2 py-1.5"
                type="button"
                onClick={copyNumber}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy number"}
              </Button>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="primary" className="py-1.5" type="button">
                  Done
                </Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
