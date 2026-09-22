"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
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
import { Card, CardCategory, Merchant } from "@/data/types"
import { CARD_CATEGORIES } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRef, useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  software: "Software",
  advertising: "Advertising",
  travel: "Travel",
  office_supplies: "Office supplies",
  professional_services: "Professional services",
  other: "Other",
}

/** One-time display concern: group a raw digit string into 4s for readability. */
function formatCardNumberForDisplay(number: string): string {
  return number.replace(/(.{4})/g, "$1 ").trim()
}

interface IssueSuccess {
  card: Card
  number: string
}

export function IssueCardDialog({
  merchants,
  onIssued,
}: {
  merchants: Merchant[]
  onIssued: (card: Card) => void
}) {
  const [open, setOpen] = useState(false)
  const [requestId, setRequestId] = useState("")
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [category, setCategory] = useState<string>("")
  const [limit, setLimit] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IssueSuccess | null>(null)
  const submittingRef = useRef(false)

  const selectedMerchant = merchants.find((m) => m.id === merchantId)
  const currency = selectedMerchant?.currency ?? ""

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      // Freshly opened for a new attempt: a fresh requestId and a blank form.
      setRequestId(crypto.randomUUID())
      setNickname("")
      setMerchantId("")
      setCategory("")
      setLimit("")
      setError(null)
      setResult(null)
      setOpen(true)
      return
    }

    // Closing (Done, Escape, overlay click, or the X). If a card was issued
    // in this session, hand it up now so the list stays current, then drop
    // the reveal-once number from memory - nothing about it survives close.
    if (result) {
      onIssued(result.card)
    }
    setResult(null)
    setError(null)
    setOpen(false)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          category,
          limit,
          currency,
          requestId,
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Something went wrong. Try again.")
        return
      }
      // A replay of an idempotent request returns number: "" - never
      // re-shown. Keep whichever result already holds the real number.
      setResult((prev) => prev ?? { card: data.card, number: data.number })
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  const parsedLimit = parseAmountToMinorUnits(limit)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="primary">Issue card</Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Card issued</DialogTitle>
              <DialogDescription>
                This is the only time the full number will be shown.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Card number
                </p>
                <p className="mt-1 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {result.number
                    ? formatCardNumberForDisplay(result.number)
                    : "Already shown - not displayed again."}
                </p>
              </div>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-gray-500">Nickname</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
                    {result.card.nickname}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Merchant</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
                    {selectedMerchant?.name ?? result.card.merchantId}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Spend limit</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
                    {formatMoney(result.card.limit, result.card.currency)}
                  </dd>
                </div>
              </dl>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="primary">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Issue a card</DialogTitle>
              <DialogDescription>
                Create a new virtual card for a merchant.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  className="mt-2"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Marketing spend"
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
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant" className="mt-2">
                    <SelectValue placeholder="Select a merchant" />
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
                  htmlFor="card-currency"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Currency
                </label>
                <Input
                  id="card-currency"
                  className="mt-2"
                  value={currency}
                  disabled
                  placeholder="Select a merchant first"
                />
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue placeholder="Select a category" />
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

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit
                </label>
                <Input
                  id="card-limit"
                  className="mt-2"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="250.00"
                  inputMode="decimal"
                  required
                />
                {limit.length > 0 && parsedLimit === null && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    Enter an amount like 250.00.
                  </p>
                )}
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-400" role="alert">
                  {error}
                </p>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={submitting} isLoading={submitting}>
                Issue card
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
