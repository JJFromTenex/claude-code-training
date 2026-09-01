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
import { Card, Currency } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { cx, focusRing } from "@/lib/utils"
import * as DialogPrimitives from "@radix-ui/react-dialog"
import { CreditCard, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue a card.
 *
 * The success screen is the only place the full number is ever shown. It is
 * held in local state for exactly as long as that screen is open and cleared
 * when the dialog closes — there is no way to get it back afterwards.
 */

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORIES = [
  "Advertising",
  "Software & subscriptions",
  "Travel",
  "Contractors",
  "Office supplies",
]

/** Select has no empty-string value, so unrestricted needs a real one. */
const NO_CATEGORY = "none"
const ERROR_ID = "card-form-error"

const LABEL = "text-sm font-medium text-gray-900 dark:text-gray-50"

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

/** The server names the field it rejected; that is what marks the input. */
interface FormError {
  field?: string
  message: string
}

export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState(NO_CATEGORY)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<FormError | null>(null)
  const [issued, setIssued] = useState<{
    card: Card
    number: string | null
  } | null>(null)
  /**
   * One key per filled-in form. A double-click, a slow network, or an
   * impatient retry sends the same key and gets the same single card back.
   */
  const [issueKey, setIssueKey] = useState(() => crypto.randomUUID())

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory(NO_CATEGORY)
    setError(null)
    setSubmitting(false)
    setIssued(null) // The full number goes with it. Nothing keeps a copy.
    setIssueKey(crypto.randomUUID()) // A fresh form is not a retry.
  }

  const openChangeHandler = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  /** Picking a merchant defaults the currency to the one they settle in. */
  const merchantChangeHandler = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const selectedMerchant = merchants.find((m) => m.id === merchantId)
  const invalid = (field: string) => error?.field === field

  const submitHandler = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // Convert at the boundary, once. The server receives minor units.
    const minorUnits = parseAmountToMinorUnits(limit)
    if (minorUnits === null) {
      setError({ field: "limit", message: "Enter a spend limit like 250 or 250.00." })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit: minorUnits,
          currency,
          category: category === NO_CATEGORY ? undefined : category,
          idempotencyKey: issueKey,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError({ field: body.field, message: body.message ?? "Could not issue the card." })
        return
      }
      setIssued({ card: body.card, number: body.number })
      // The list behind the dialog is a server component; refresh it.
      router.refresh()
    } catch {
      setError({ message: "Could not reach the server. Try again." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogPrimitives.Root open={open} onOpenChange={openChangeHandler}>
      <DialogPrimitives.Trigger asChild>
        <Button variant="primary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DialogPrimitives.Trigger>
      <DialogPrimitives.Portal>
        <DialogPrimitives.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <DialogPrimitives.Content
          className={cx(
            "fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border p-4 shadow-lg sm:p-6",
            "border-gray-200 bg-white dark:border-gray-900 dark:bg-[#090E1A]",
            focusRing,
          )}
        >
          {issued ? (
            <RevealOnce
              card={issued.card}
              number={issued.number}
              merchantName={selectedMerchant?.name ?? issued.card.merchantId}
              onDone={() => openChangeHandler(false)}
            />
          ) : (
            <form onSubmit={submitHandler}>
              <DialogPrimitives.Title className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Issue a virtual card
              </DialogPrimitives.Title>
              <DialogPrimitives.Description className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                The card number is shown once, on the next screen. After that only
                the last four are kept.
              </DialogPrimitives.Description>

              <div className="mt-4 flex flex-col gap-4">
                <div>
                  <label htmlFor="card-nickname" className={LABEL}>
                    Nickname
                  </label>
                  <Input
                    id="card-nickname"
                    name="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Ad spend — Q3"
                    className="mt-2"
                    hasError={invalid("nickname")}
                    aria-invalid={invalid("nickname")}
                    aria-describedby={invalid("nickname") ? ERROR_ID : undefined}
                  />
                </div>

                <LabelledSelect
                  id="card-merchant"
                  label="Merchant"
                  value={merchantId || undefined}
                  onChange={merchantChangeHandler}
                  placeholder="Choose a merchant"
                  invalid={invalid("merchantId")}
                  options={merchants.map((m) => ({ value: m.id, label: m.name }))}
                />

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="card-limit" className={LABEL}>
                      Spend limit
                    </label>
                    <Input
                      id="card-limit"
                      name="limit"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="2500.00"
                      inputMode="decimal"
                      className="mt-2"
                      hasError={invalid("limit")}
                      aria-invalid={invalid("limit")}
                      aria-describedby={invalid("limit") ? ERROR_ID : undefined}
                    />
                  </div>
                  <div className="w-32">
                    {/*
                      Once a merchant is chosen the currency is theirs, so the
                      only option offered is the one the server will accept.
                      The server checks the pair regardless.
                    */}
                    <LabelledSelect
                      id="card-currency"
                      label="Currency"
                      value={currency}
                      onChange={(value) => setCurrency(value as Currency)}
                      invalid={invalid("currency")}
                      options={(selectedMerchant
                        ? [selectedMerchant.currency]
                        : CURRENCIES
                      ).map((c) => ({ value: c, label: c }))}
                    />
                  </div>
                </div>

                <LabelledSelect
                  id="card-category"
                  label="Category lock"
                  optional
                  value={category}
                  onChange={setCategory}
                  options={[
                    { value: NO_CATEGORY, label: "Unrestricted" },
                    ...CATEGORIES.map((c) => ({ value: c, label: c })),
                  ]}
                />
              </div>

              {error && (
                <p
                  id={ERROR_ID}
                  role="alert"
                  className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
                >
                  {error.message}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end sm:space-x-2 dark:border-gray-900">
                <DialogPrimitives.Close asChild>
                  <Button variant="secondary" className="py-1.5" type="button">
                    Cancel
                  </Button>
                </DialogPrimitives.Close>
                <Button variant="primary" className="py-1.5" type="submit" disabled={submitting}>
                  {submitting ? "Issuing…" : "Issue card"}
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitives.Content>
      </DialogPrimitives.Portal>
    </DialogPrimitives.Root>
  )
}

/**
 * A labelled Select. The trigger is a button, so the label is tied to it with
 * aria-labelledby rather than htmlFor, and a rejected field carries both
 * hasError and aria-describedby pointing at the form's error message.
 */
function LabelledSelect({
  id,
  label,
  optional,
  value,
  onChange,
  placeholder,
  invalid,
  options,
}: {
  id: string
  label: string
  optional?: boolean
  value: string | undefined
  onChange: (value: string) => void
  placeholder?: string
  invalid?: boolean
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <span id={`${id}-label`} className={LABEL}>
        {label}
        {optional && <span className="font-normal text-gray-500"> optional</span>}
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          className="mt-2"
          aria-labelledby={`${id}-label`}
          hasError={invalid}
          aria-invalid={invalid}
          aria-describedby={invalid ? ERROR_ID : undefined}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/**
 * The one screen that shows a full card number. Closing it is irreversible,
 * so it says so. A null number means this was a repeat submit.
 */
function RevealOnce({
  card,
  number,
  merchantName,
  onDone,
}: {
  card: Card
  number: string | null
  merchantName: string
  onDone: () => void
}) {
  const grouped = number?.replace(/(\d{4})(?=\d)/g, "$1 ") ?? null

  return (
    <div>
      <DialogPrimitives.Title className="text-base font-semibold text-gray-900 dark:text-gray-50">
        Card issued
      </DialogPrimitives.Title>
      <DialogPrimitives.Description className="mt-1 text-sm text-gray-500 dark:text-gray-500">
        {grouped
          ? `This is the only time the full number is shown. Copy it now — after you close this, only ${maskCardNumber(card.last4)} is kept.`
          : `This card was already issued by that submit, so one card exists rather than two. Its number was shown once and cannot be shown again.`}
      </DialogPrimitives.Description>

      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex items-center gap-2 text-gray-500">
          <CreditCard className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-sm">{card.nickname}</span>
        </div>
        <p className="mt-2 font-mono text-lg font-medium tracking-wider text-gray-900 tabular-nums dark:text-gray-50">
          {grouped ?? maskCardNumber(card.last4)}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500">Merchant</dt>
          <dd className="text-gray-900 dark:text-gray-50">{merchantName}</dd>
          <dt className="text-gray-500">Spend limit</dt>
          <dd className="text-gray-900 tabular-nums dark:text-gray-50">
            {formatMoney(card.limit, card.currency)} {card.currency}
          </dd>
          {card.category && (
            <>
              <dt className="text-gray-500">Category lock</dt>
              <dd className="text-gray-900 dark:text-gray-50">{card.category}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="mt-6 flex justify-end border-t border-gray-200 pt-4 dark:border-gray-900">
        <Button variant="primary" className="py-1.5" onClick={onDone}>
          Done — hide the number
        </Button>
      </div>
    </div>
  )
}
