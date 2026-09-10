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
import { merchantById, merchants } from "@/data/merchants"
import { CardCategory } from "@/data/types"
import { CARD_CATEGORIES, maskCardNumber } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

type FieldErrors = {
  nickname?: string
  merchantId?: string
  spendLimit?: string
  category?: string
}

export function IssueCardDrawer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [spendLimitInput, setSpendLimitInput] = useState("")
  const [category, setCategory] = useState<CardCategory | "">("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState("")
  const [reveal, setReveal] = useState<{ number: string; last4: string } | null>(
    null,
  )

  const selectedMerchant = merchantById(merchantId)

  const resetForm = () => {
    setNickname("")
    setMerchantId("")
    setSpendLimitInput("")
    setCategory("")
    setFieldErrors({})
    setFormError(null)
    setSubmitting(false)
  }

  // Opening starts a brand new submission: fresh form, fresh idempotency key.
  // Closing (Escape, overlay click, the header's close button, or the
  // post-success "Done" button all route through here) drops the revealed
  // number from state so it can never be recovered after the drawer shuts.
  const handleOpenChange = (next: boolean) => {
    if (next) {
      resetForm()
      setReveal(null)
      setIdempotencyKey(crypto.randomUUID())
    } else {
      setReveal(null)
    }
    setOpen(next)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const errors: FieldErrors = {}
    if (!nickname.trim()) errors.nickname = "Give the card a nickname."
    if (!merchantId) errors.merchantId = "Choose a merchant."
    if (!category) errors.category = "Choose a category."

    const minorUnits = parseAmountToMinorUnits(spendLimitInput)
    if (minorUnits === null) {
      errors.spendLimit = "Enter a valid amount, like 250.00."
    }

    if (Object.keys(errors).length > 0 || minorUnits === null || !selectedMerchant) {
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    setFormError(null)
    setSubmitting(true)

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit: minorUnits,
          currency: selectedMerchant.currency,
          category,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        setFormError(body?.message ?? "Something went wrong. Try again.")
        return
      }

      router.refresh()

      if (typeof body.number === "string") {
        setReveal({ number: body.number, last4: body.card.last4 })
      } else {
        // A repeated Idempotency-Key returns the existing card with no
        // number: it was already revealed once on the original request and
        // the server will not hand it out a second time.
        setFormError(
          "This card was already issued. The number was shown once and cannot be shown again.",
        )
      }
    } catch {
      setFormError("Something went wrong. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button>Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Issue a virtual card</DrawerTitle>
          <DrawerDescription>
            The limit is typed here and validated, not sent in a chat message.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {reveal ? (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                  This is the only time the full card number will be shown.
                  Copy it now.
                </p>
                <p className="mt-3 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                  {reveal.number}
                </p>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                  From now on it is stored and displayed only as{" "}
                  <span className="font-mono">
                    {maskCardNumber(reveal.last4)}
                  </span>
                  .
                </p>
              </div>
            </div>
          ) : (
            <form
              id="issue-card-form"
              className="space-y-4"
              onSubmit={handleSubmit}
              noValidate
            >
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  className="mt-1"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="e.g. Ad spend – Q4"
                  hasError={Boolean(fieldErrors.nickname)}
                  aria-invalid={Boolean(fieldErrors.nickname)}
                />
                {fieldErrors.nickname && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {fieldErrors.nickname}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger
                    id="card-merchant"
                    className="mt-1"
                    hasError={Boolean(fieldErrors.merchantId)}
                    aria-invalid={Boolean(fieldErrors.merchantId)}
                  >
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
                {fieldErrors.merchantId && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {fieldErrors.merchantId}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="card-spend-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    id="card-spend-limit"
                    inputMode="decimal"
                    value={spendLimitInput}
                    onChange={(event) => setSpendLimitInput(event.target.value)}
                    placeholder="250.00"
                    hasError={Boolean(fieldErrors.spendLimit)}
                    aria-invalid={Boolean(fieldErrors.spendLimit)}
                  />
                  <span
                    className="shrink-0 text-sm font-medium text-gray-500 dark:text-gray-500"
                    aria-label="Currency, set by the selected merchant"
                  >
                    {selectedMerchant ? selectedMerchant.currency : "—"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Currency follows the merchant and cannot be changed here.
                </p>
                {fieldErrors.spendLimit && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {fieldErrors.spendLimit}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger
                    id="card-category"
                    className="mt-1"
                    hasError={Boolean(fieldErrors.category)}
                    aria-invalid={Boolean(fieldErrors.category)}
                  >
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CATEGORY_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.category && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {fieldErrors.category}
                  </p>
                )}
              </div>

              {formError && (
                <p className="text-sm text-red-600 dark:text-red-500">
                  {formError}
                </p>
              )}
            </form>
          )}
        </DrawerBody>
        <DrawerFooter>
          {reveal ? (
            <Button onClick={() => handleOpenChange(false)}>Done</Button>
          ) : (
            <>
              <DrawerClose asChild>
                <Button variant="secondary" disabled={submitting}>
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                form="issue-card-form"
                disabled={submitting}
                isLoading={submitting}
                loadingText="Issuing…"
              >
                Issue card
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
