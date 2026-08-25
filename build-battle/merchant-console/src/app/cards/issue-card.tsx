"use client"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { CATEGORY_LABELS } from "@/data/cards"
import { Card, Currency, MerchantCategory } from "@/data/types"
import {
  MAX_SPEND_LIMIT,
  formatCardNumber,
  maskCardNumber,
} from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

const NO_CATEGORY = "none"

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `key_${Date.now()}_${Math.round(Math.random() * 1e9)}`

export function IssueCard({
  merchants,
  currencies,
  categories,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
  currencies: readonly Currency[]
  categories: readonly MerchantCategory[]
}) {
  const router = useRouter()
  const fieldId = useId()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<string>(NO_CATEGORY)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  /**
   * The one and only copy of a full card number. It lives in this state until
   * the success screen is dismissed, and there is nowhere to read it back from.
   */
  const [issued, setIssued] = useState<{
    card: Card
    cardNumber: string | null
  } | null>(null)

  /**
   * One key per filled-in form. A double-click or a retried request reuses it,
   * so the server returns the card it already made instead of a second one.
   */
  const [idempotencyKey, setIdempotencyKey] = useState(() => newKey())

  const selectedMerchant = merchants.find((m) => m.id === merchantId)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory(NO_CATEGORY)
    setError(null)
  }

  const dismiss = () => {
    // Clears the number from client state. After this it exists nowhere.
    setIssued(null)
    setOpen(false)
    router.refresh()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // A convenience so the round trip is not wasted. The server decides.
    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter a spend limit like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          category: category === NO_CATEGORY ? null : category,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        setError(body.message ?? "The card could not be issued.")
        return
      }

      setIssued({ card: body.card, cardNumber: body.cardNumber })
      // The next card issued from this form is a different card.
      setIdempotencyKey(newKey())
      reset()
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and retry.")
    } finally {
      setSubmitting(false)
    }
  }

  if (issued) {
    return (
      <section
        aria-labelledby={`${fieldId}-issued`}
        className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/40 sm:p-6"
      >
        <h2
          id={`${fieldId}-issued`}
          className="text-sm font-semibold text-emerald-900 dark:text-emerald-100"
        >
          {issued.card.nickname} is issued
        </h2>
        {issued.cardNumber ? (
          <>
            <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
              This is the only time the full number is shown. Copy it now — from
              here on the card reads {maskCardNumber(issued.card.last4)}.
            </p>
            <p
              className="mt-4 font-mono text-xl tracking-wider text-gray-900 dark:text-gray-50"
              aria-label={`Card number ${issued.cardNumber.split("").join(" ")}`}
            >
              {formatCardNumber(issued.cardNumber)}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
            This request had already been sent, so no second card was created.
            The number was shown once when the card was first issued and cannot
            be shown again — this card reads{" "}
            {maskCardNumber(issued.card.last4)}.
          </p>
        )}
        <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-200">
          Limit {formatMoney(issued.card.spendLimit, issued.card.currency)}{" "}
          {issued.card.currency} · reference {issued.card.reference}
        </p>
        <Button className="mt-4 py-1.5" onClick={dismiss} autoFocus>
          Done — hide the number
        </Button>
      </section>
    )
  }

  if (!open) {
    return (
      <Button className="w-full gap-2 py-1.5 sm:w-fit" onClick={() => setOpen(true)}>
        <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
        Issue a card
      </Button>
    )
  }

  return (
    <form
      onSubmit={submit}
      aria-labelledby={`${fieldId}-heading`}
      className="rounded-lg border border-gray-200 p-4 dark:border-gray-800 sm:p-6"
    >
      <h2
        id={`${fieldId}-heading`}
        className="text-sm font-semibold text-gray-900 dark:text-gray-50"
      >
        Issue a virtual card
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor={`${fieldId}-nickname`}
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Nickname
          </label>
          <Input
            id={`${fieldId}-nickname`}
            name="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Meta Ads"
            className="mt-2"
          />
        </div>

        <div>
          <label
            htmlFor={`${fieldId}-merchant`}
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Merchant
          </label>
          <Select
            value={merchantId}
            onValueChange={(next) => {
              setMerchantId(next)
              // Default to how the merchant settles; still editable.
              const merchant = merchants.find((m) => m.id === next)
              if (merchant) setCurrency(merchant.currency)
            }}
          >
            <SelectTrigger id={`${fieldId}-merchant`} className="mt-2">
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
            htmlFor={`${fieldId}-limit`}
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Spend limit
          </label>
          <Input
            id={`${fieldId}-limit`}
            name="spendLimit"
            inputMode="decimal"
            value={limit}
            onChange={(event) => setLimit(event.target.value)}
            placeholder="250.00"
            className="mt-2"
            aria-describedby={`${fieldId}-limit-hint`}
          />
          <p id={`${fieldId}-limit-hint`} className="mt-1 text-sm text-gray-500">
            Up to {formatMoney(MAX_SPEND_LIMIT, currency)}.
          </p>
        </div>

        <div>
          <label
            htmlFor={`${fieldId}-currency`}
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Currency
          </label>
          <Select
            value={currency}
            onValueChange={(next) => setCurrency(next as Currency)}
          >
            <SelectTrigger id={`${fieldId}-currency`} className="mt-2">
              <SelectValue placeholder="Currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMerchant && (
            <p className="mt-1 text-sm text-gray-500">
              {selectedMerchant.name} settles in {selectedMerchant.currency}.
            </p>
          )}
        </div>

        <div>
          <label
            htmlFor={`${fieldId}-category`}
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Category lock
          </label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id={`${fieldId}-category`} className="mt-2">
              <SelectValue placeholder="No lock" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_CATEGORY}>No lock</SelectItem>
              {categories.map((value) => (
                <SelectItem key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="submit" className="py-1.5" isLoading={submitting}>
          Issue card
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="py-1.5"
          onClick={() => {
            reset()
            setOpen(false)
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
