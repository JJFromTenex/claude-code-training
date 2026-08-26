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
import { Card, Currency } from "@/data/types"
import { CURRENCIES, formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { RiAddLine } from "@remixicon/react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "USD",
  EUR: "EUR",
  GBP: "GBP",
}

interface IssueResult {
  card: Card
  fullNumber: string
}

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string }[]
}) {
  const router = useRouter()

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<IssueResult | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("USD")
    setSubmitting(false)
    setError(null)
    setResult(null)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const limit = parseAmountToMinorUnits(limitInput)
    if (limit === null || limit <= 0) {
      setError("Enter a spend limit greater than zero.")
      return
    }
    if (limit > 5_000_000) {
      setError("Spend limit cannot exceed 5,000,000 minor units.")
      return
    }
    if (!merchantId) {
      setError("Choose a merchant.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, merchantId, limit, currency }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "Something went wrong. Try again.")
        return
      }
      setResult(body as IssueResult)
      router.refresh()
    } catch {
      setError("Couldn't reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog onOpenChange={(open) => !open && reset()}>
      <DialogTrigger asChild>
        <Button variant="primary" className="w-full gap-2 py-1.5 sm:w-fit">
          <RiAddLine className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DialogTrigger>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Card issued</DialogTitle>
              <DialogDescription>
                This is the only time the full number is shown.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-3">
              <p className="text-sm text-gray-500">
                Copy it now — Northwind never shows it again.
              </p>
              <p className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-center font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
                {result.fullNumber}
              </p>
              <p className="text-sm text-gray-500">
                {result.card.nickname || result.card.id} ·{" "}
                {formatMoney(result.card.limit, result.card.currency)} limit
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Done</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Issue a card</DialogTitle>
              <DialogDescription>
                Cards are virtual, single-merchant, and need a limit from the
                moment they exist.
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
                  placeholder="Ad spend — Q3"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant">
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
                <div className="flex flex-1 flex-col gap-1.5">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    inputMode="decimal"
                    enableStepper={false}
                    value={limitInput}
                    onChange={(event) => setLimitInput(event.target.value)}
                    placeholder="5000.00"
                  />
                </div>
                <div className="flex w-28 flex-col gap-1.5">
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
                    <SelectTrigger id="card-currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {CURRENCY_LABELS[code]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="submit" isLoading={submitting} loadingText="Issuing…">
                Issue card
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
