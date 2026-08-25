"use client"

import { useId, useRef, useState } from "react"
import { useRouter } from "next/navigation"

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
import type { Card, Currency, MerchantCategory } from "@/data/types"

const CATEGORIES: { value: MerchantCategory; label: string }[] = [
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel" },
  { value: "contractors", label: "Contractors" },
  { value: "utilities", label: "Utilities" },
]

const NO_CATEGORY = "none"

type FormState = {
  nickname: string
  merchantId: string
  spendLimit: string
  category: string
}

const EMPTY_FORM: FormState = {
  nickname: "",
  merchantId: "",
  spendLimit: "",
  category: NO_CATEGORY,
}

type IssueResult = { card: Card; fullNumber: string }

export function IssueCardForm({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<IssueResult | null>(null)

  // One idempotency key per issue *attempt*. It is created lazily on the
  // first submit (a ref, not state, so re-renders never regenerate it) and
  // reused across retries of that same attempt — e.g. the user fixes a
  // validation error and hits "Issue card" again — so a duplicate network
  // request never becomes a duplicate card. A fresh key is drawn once the
  // attempt succeeds or the drawer is closed and reopened for a new one.
  const idempotencyKeyRef = useRef<string | null>(null)

  const nicknameId = useId()
  const merchantIdFieldId = useId()
  const spendLimitId = useId()
  const currencyId = useId()
  const categoryId = useId()

  const selectedMerchant = merchants.find(
    (merchant) => merchant.id === form.merchantId,
  )
  const currency = selectedMerchant?.currency

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Clear the form, any error, and — critically — the full card number
      // from state so reopening the drawer never shows it again.
      setForm(EMPTY_FORM)
      setError(null)
      setResult(null)
      setSubmitting(false)
      idempotencyKeyRef.current = null
    }
    setOpen(next)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    if (!currency) {
      setError("Choose a merchant.")
      return
    }

    setSubmitting(true)

    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID()
    }

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Transport metadata, not part of the card: the key rides on the
          // header so a double-clicked submit replays instead of issuing twice.
          "idempotency-key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit: form.spendLimit,
          currency,
          category: form.category === NO_CATEGORY ? null : form.category,
        }),
      })

      if (!response.ok) {
        const body = (await response.json()) as { message: string }
        setError(body.message)
        setSubmitting(false)
        return
      }

      const body = (await response.json()) as IssueResult
      setResult(body)
      setSubmitting(false)
      // The attempt succeeded — a later issue from this same drawer session
      // is a new attempt and gets its own key.
      idempotencyKeyRef.current = null
      router.refresh()
    } catch {
      setError("Something went wrong issuing the card. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button>Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {result ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full card number is shown. Copy it
                now — it will not appear again.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-500">
                  Card number
                </p>
                <p className="mt-1 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                  {result.fullNumber}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500 dark:text-gray-500">
                    Nickname
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {result.card.nickname}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-500">
                    Last four
                  </dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    •••• {result.card.last4}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Create a new virtual card for a merchant.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                >
                  {error}
                </p>
              )}

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={nicknameId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id={nicknameId}
                  name="nickname"
                  value={form.nickname}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      nickname: event.target.value,
                    }))
                  }
                  placeholder="e.g. Ad spend — Q3"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={merchantIdFieldId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) =>
                    setForm((prev) => ({ ...prev, merchantId }))
                  }
                >
                  <SelectTrigger id={merchantIdFieldId}>
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

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={spendLimitId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit
                </label>
                <Input
                  id={spendLimitId}
                  name="spendLimit"
                  inputMode="decimal"
                  value={form.spendLimit}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      spendLimit: event.target.value,
                    }))
                  }
                  placeholder="250.00"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={currencyId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Currency
                </label>
                {/* Derived from the merchant, not chosen — a merchant only
                    ever bills in its own currency, so letting ops pick a
                    different one just invites a 400 from the server. */}
                <Input
                  id={currencyId}
                  name="currency"
                  value={currency ?? ""}
                  readOnly
                  placeholder="Choose a merchant to set the currency"
                  aria-describedby={`${currencyId}-hint`}
                  inputClassName="cursor-not-allowed bg-gray-50 dark:bg-gray-900"
                />
                <p
                  id={`${currencyId}-hint`}
                  className="text-xs text-gray-500 dark:text-gray-500"
                >
                  Set by the merchant&apos;s billing currency.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={categoryId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant category (optional)
                </label>
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    setForm((prev) => ({ ...prev, category }))
                  }
                >
                  <SelectTrigger id={categoryId}>
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>No category</SelectItem>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" isLoading={submitting} loadingText="Issuing...">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
