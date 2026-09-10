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
import {
  CARD_CURRENCIES,
  CATEGORY_LABELS,
  IssueCardField,
  MERCHANT_CATEGORIES,
  maskCardNumber,
} from "@/data/cardRules"
import { Card, Currency, MerchantCategory } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }
type FieldErrors = Partial<Record<IssueCardField, string>>

const EMPTY_FORM = {
  nickname: "",
  merchantId: "",
  limit: "",
  currency: "" as Currency | "",
  category: "" as MerchantCategory | "",
}

/** Display only: 4242 6714 4854 2223. */
const groupDigits = (number: string) => number.replace(/(\d{4})(?=\d)/g, "$1 ")

export function IssueCardDrawer({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicateOf, setDuplicateOf] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // One key per issue attempt: a double-click or a retry after a timeout
  // resends the same key, and the server refuses to mint a second card.
  const [requestKey, setRequestKey] = useState("")
  // The full number lives here only until the drawer closes.
  const [issued, setIssued] = useState<{ card: Card; number: string } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  const merchant = merchants.find((m) => m.id === form.merchantId)

  const onOpenChange = (next: boolean) => {
    if (next) {
      setForm(EMPTY_FORM)
      setErrors({})
      setFormError(null)
      setDuplicateOf(null)
      setRequestKey(crypto.randomUUID())
    } else {
      if (issued) router.refresh()
      setIssued(null)
      setCopied(false)
    }
    setOpen(next)
  }

  const update = (changes: Partial<typeof EMPTY_FORM>) => {
    setForm((current) => ({ ...current, ...changes }))
    setErrors((current) => {
      const next = { ...current }
      for (const key of Object.keys(changes)) {
        delete next[(key === "limit" ? "spendLimit" : key) as IssueCardField]
      }
      return next
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setFormError(null)
    setDuplicateOf(null)

    // Converted once, here at the boundary. Anything unparseable goes to the
    // server as null so every field's problem comes back in one round trip.
    const spendLimit = parseAmountToMinorUnits(form.limit)
    const limitHint =
      spendLimit !== null
        ? null
        : form.limit.trim()
          ? "Enter an amount like 250 or 250.00."
          : "Enter a spend limit."

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": requestKey,
        },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit,
          currency: form.currency,
          category: form.category,
        }),
      })
      const body = await response.json()

      if (response.status === 201) {
        setIssued({ card: body.card, number: body.number })
      } else if (response.status === 409) {
        setDuplicateOf(body.error.cardId)
      } else {
        const fields: FieldErrors = body.error?.fields ?? {}
        if (limitHint && fields.spendLimit) fields.spendLimit = limitHint
        setErrors(fields)
        setFormError(body.error?.message ?? "The card could not be issued.")
      }
    } catch {
      setFormError(
        "Could not reach the server. Try again; a retry will not issue a second card.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async () => {
    if (!issued) return
    await navigator.clipboard.writeText(issued.number)
    setCopied(true)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent
        className="sm:max-w-md"
        onOpenAutoFocus={(event) => {
          // Start on the first field rather than the close button.
          event.preventDefault()
          document.getElementById("card-nickname")?.focus()
        }}
      >
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                {issued.card.nickname} is active. Copy the number now: this is
                the only time it is shown in full. After you close this, the
                console only ever shows {maskCardNumber(issued.card.last4)}.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="text-sm text-gray-500" id="revealed-number-label">
                Card number
              </p>
              <p
                aria-labelledby="revealed-number-label"
                className="mt-1 font-mono text-2xl tracking-wider text-gray-900 dark:text-gray-50"
              >
                {groupDigits(issued.number)}
              </p>
              <Button
                variant="secondary"
                className="mt-4 py-1.5"
                onClick={copy}
              >
                {copied ? "Copied" : "Copy number"}
              </Button>
              <p aria-live="polite" className="sr-only">
                {copied ? "Card number copied to clipboard" : ""}
              </p>
            </DrawerBody>
            <DrawerFooter className="gap-2">
              <Button variant="secondary" asChild>
                <Link href={`/cards/${issued.card.id}`}>View card</Link>
              </Button>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single-merchant and virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-5">
              <Field id="card-nickname" label="Nickname" error={errors.nickname}>
                <Input
                  id="card-nickname"
                  value={form.nickname}
                  onChange={(event) => update({ nickname: event.target.value })}
                  placeholder="Meta ad spend"
                  maxLength={40}
                  hasError={Boolean(errors.nickname)}
                  aria-invalid={Boolean(errors.nickname)}
                  aria-describedby={errors.nickname ? "card-nickname-error" : undefined}
                />
              </Field>

              <Field id="card-merchant" label="Merchant" error={errors.merchantId}>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) => {
                    const chosen = merchants.find((m) => m.id === merchantId)
                    update({ merchantId, currency: chosen?.currency ?? "" })
                  }}
                >
                  <SelectTrigger
                    id="card-merchant"
                    hasError={Boolean(errors.merchantId)}
                    aria-invalid={Boolean(errors.merchantId)}
                    aria-describedby={errors.merchantId ? "card-merchant-error" : undefined}
                  >
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
              </Field>

              <div className="grid grid-cols-[1fr_7rem] gap-3">
                <Field id="card-limit" label="Spend limit" error={errors.spendLimit}>
                  <Input
                    id="card-limit"
                    inputMode="decimal"
                    autoComplete="off"
                    value={form.limit}
                    onChange={(event) => update({ limit: event.target.value })}
                    placeholder="250.00"
                    hasError={Boolean(errors.spendLimit)}
                    aria-invalid={Boolean(errors.spendLimit)}
                    aria-describedby={
                      errors.spendLimit ? "card-limit-error" : "card-limit-hint"
                    }
                  />
                </Field>

                <Field id="card-currency" label="Currency" error={errors.currency}>
                  <Select
                    value={form.currency}
                    onValueChange={(currency) =>
                      update({ currency: currency as Currency })
                    }
                  >
                    <SelectTrigger
                      id="card-currency"
                      hasError={Boolean(errors.currency)}
                      aria-invalid={Boolean(errors.currency)}
                      aria-describedby={
                        errors.currency ? "card-currency-error" : undefined
                      }
                    >
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <p id="card-limit-hint" className="-mt-3 text-xs text-gray-500">
                Up to 50,000.00.
                {merchant
                  ? ` ${merchant.name} settles in ${merchant.currency}, so the card does too.`
                  : ""}
              </p>

              <Field
                id="card-category"
                label="Merchant category lock"
                error={errors.category}
              >
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    update({ category: category as MerchantCategory })
                  }
                >
                  <SelectTrigger
                    id="card-category"
                    hasError={Boolean(errors.category)}
                    aria-invalid={Boolean(errors.category)}
                    aria-describedby={
                      errors.category ? "card-category-error" : undefined
                    }
                  >
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {MERCHANT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {formError && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-400/10 dark:text-red-400"
                >
                  {formError}
                </p>
              )}
              {duplicateOf && (
                <p
                  role="alert"
                  className="rounded-md bg-yellow-50 p-3 text-sm text-yellow-900 dark:bg-yellow-400/10 dark:text-yellow-500"
                >
                  This request already issued a card, so no second card was
                  created.{" "}
                  <Link
                    href={`/cards/${duplicateOf}`}
                    className="font-medium underline"
                  >
                    Open the card
                  </Link>
                </p>
              )}
            </DrawerBody>

            <DrawerFooter className="gap-2">
              <DrawerClose asChild>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Issuing…"
                disabled={Boolean(duplicateOf)}
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-900 dark:text-gray-50"
      >
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
