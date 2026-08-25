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
import { Currency, Merchant } from "@/data/types"
import { CARD_CATEGORIES } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORY_LABELS: Record<(typeof CARD_CATEGORIES)[number], string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

interface FieldErrors {
  [field: string]: string
}

/**
 * Issue a card, then show its number exactly once.
 *
 * The number lives in local state for the life of the success panel and is
 * cleared when the drawer closes. It is never written anywhere else, because
 * the server never stored it — see `.claude/rules/cards.md`.
 */
export function IssueCardDialog({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [categoryLock, setCategoryLock] = useState("")

  const [errors, setErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<{
    cardNumber: string
    nickname: string
  } | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("USD")
    setCategoryLock("")
    setErrors({})
    setFormError(null)
    setRevealed(null)
  }

  const close = () => {
    setOpen(false)
    // The number goes with the panel. Nothing keeps a copy.
    reset()
  }

  const chooseMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    // A card that settles in a currency its merchant does not use is refused
    // server-side, so follow the merchant rather than let ops walk into it.
    if (merchant !== undefined) setCurrency(merchant.currency)
  }

  const submit = async () => {
    setSubmitting(true)
    setErrors({})
    setFormError(null)

    const spendLimit = parseAmountToMinorUnits(limitInput)
    if (spendLimit === null) {
      setErrors({ spendLimit: "Enter an amount like 250 or 250.00." })
      setSubmitting(false)
      return
    }

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          categoryLock: categoryLock === "" ? null : categoryLock,
          // A double-clicked button must not cost the merchant two cards.
          requestId: crypto.randomUUID(),
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        const next: FieldErrors = {}
        for (const error of payload.errors ?? []) next[error.field] = error.message
        setErrors(next)
        setFormError(
          Object.keys(next).length === 0
            ? (payload.message ?? "The card could not be issued.")
            : null,
        )
        return
      }

      setRevealed({ cardNumber: payload.cardNumber, nickname: payload.card.nickname })
      router.refresh()
    } catch {
      setFormError("Could not reach the server. The card was not issued.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-md">
        {revealed === null ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                The number is generated when you submit and shown once.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              {formError !== null && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
                >
                  {formError}
                </p>
              )}

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
                  placeholder="Ad spend — Q3"
                  value={nickname}
                  hasError={errors.nickname !== undefined}
                  onChange={(event) => setNickname(event.target.value)}
                />
                {errors.nickname !== undefined && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {errors.nickname}
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
                <Select value={merchantId} onValueChange={chooseMerchant}>
                  <SelectTrigger id="card-merchant" className="mt-2">
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
                {errors.merchantId !== undefined && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {errors.merchantId}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                    inputMode="decimal"
                    placeholder="250.00"
                    value={limitInput}
                    hasError={errors.spendLimit !== undefined}
                    onChange={(event) => setLimitInput(event.target.value)}
                  />
                </div>
                <div>
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
                    <SelectTrigger id="card-currency" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {errors.spendLimit !== undefined && (
                <p className="-mt-2 text-sm text-red-600 dark:text-red-500">
                  {errors.spendLimit}
                </p>
              )}
              {errors.currency !== undefined && (
                <p className="-mt-2 text-sm text-red-600 dark:text-red-500">
                  {errors.currency}
                </p>
              )}

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">optional</span>
                </label>
                <Select value={categoryLock} onValueChange={setCategoryLock}>
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue placeholder="No lock" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryLock !== undefined && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    {errors.categoryLock}
                  </p>
                )}
              </div>
            </DrawerBody>

            <DrawerFooter>
              <Button variant="secondary" className="py-1.5" onClick={close}>
                Cancel
              </Button>
              <Button
                className="py-1.5"
                disabled={submitting}
                onClick={submit}
              >
                {submitting ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle>{revealed.nickname} is live</DrawerTitle>
              <DrawerDescription className="text-sm">
                This is the only time the full number is shown. Copy it now —
                it was never stored and cannot be shown again.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody>
              <p className="rounded-md bg-gray-50 p-4 text-center font-mono text-lg tracking-widest text-gray-900 dark:bg-gray-900 dark:text-gray-50">
                {revealed.cardNumber.replace(/(.{4})/g, "$1 ").trim()}
              </p>
              <p className="mt-3 text-sm text-gray-500">
                Everywhere else this card appears as ••••{" "}
                {revealed.cardNumber.slice(-4)}.
              </p>
            </DrawerBody>

            <DrawerFooter>
              <Button className="py-1.5" onClick={close}>
                Done
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
