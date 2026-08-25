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
import { Currency } from "@/data/types"
import {
  CARD_CURRENCIES,
  CATEGORY_LOCKS,
  CATEGORY_LOCK_LABELS,
  CategoryLock,
  maskCardNumber,
} from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Check, Copy, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

interface Issued {
  nickname: string
  last4: string
  fullNumber: string
  spendLimit: number
  currency: Currency
}

const EMPTY = {
  nickname: "",
  merchantId: "",
  limit: "",
  currency: "" as Currency | "",
  categoryLock: "" as CategoryLock | "",
}

/**
 * Issue a virtual card (NWP-201).
 *
 * The full number arrives in the creation response and is held in local state
 * for the success step only — closing the drawer drops it, and no other route
 * will return it again. Validation here is a convenience; the route re-checks
 * every field.
 */
export function IssueCardDrawer({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)

  const merchant = merchants.find((m) => m.id === form.merchantId)
  const currency = form.currency || merchant?.currency || ""
  const currencyMismatch = Boolean(
    merchant && form.currency && form.currency !== merchant.currency,
  )

  function reset() {
    setForm(EMPTY)
    setErrors({})
    setFormError(null)
    setIssued(null)
    setCopied(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Drop the revealed number as soon as the drawer closes. It is not
    // recoverable, and it should not survive in client state.
    if (!next) reset()
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFormError(null)

    const spendLimit = parseAmountToMinorUnits(form.limit)
    const clientErrors: Record<string, string> = {}
    if (!form.nickname.trim()) clientErrors.nickname = "Give the card a nickname."
    if (!form.merchantId) clientErrors.merchantId = "Choose a merchant."
    if (spendLimit === null) {
      clientErrors.spendLimit = "Enter an amount like 250 or 250.00."
    }
    if (!currency) clientErrors.currency = "Choose a currency."

    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    setErrors({})
    setSubmitting(true)

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          merchantId: form.merchantId,
          spendLimit,
          currency,
          categoryLock: form.categoryLock || null,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setErrors(payload?.errors ?? {})
        setFormError(payload?.message ?? "Could not issue the card.")
        return
      }

      setIssued({
        nickname: payload.card.nickname,
        last4: payload.card.last4,
        fullNumber: payload.fullNumber,
        spendLimit: payload.card.spendLimit,
        currency: payload.card.currency,
      })
      router.refresh()
    } catch {
      setFormError("Could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function copyNumber() {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.fullNumber)
      setCopied(true)
    } catch {
      // Clipboard can be blocked; the number is on screen either way.
      setCopied(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                {issued.nickname} ·{" "}
                {formatMoney(issued.spendLimit, issued.currency)} limit
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/30">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  This is the only time the full number is shown.
                </p>
                <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                  Copy it now. Everywhere else the card reads{" "}
                  {maskCardNumber(issued.last4)}.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-4 dark:border-gray-800">
                <span className="font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.fullNumber.replace(/(.{4})/g, "$1 ").trim()}
                </span>
                <Button
                  variant="secondary"
                  className="shrink-0 gap-2 py-1.5"
                  onClick={copyNumber}
                >
                  {copied ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button variant="secondary" onClick={() => handleOpenChange(false)}>
                Done
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, always virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="flex flex-col gap-5">
              {formError && (
                <p
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300"
                >
                  {formError}
                </p>
              )}

              <div>
                <label
                  htmlFor="nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  className="mt-2"
                  placeholder="Google Ads — brand"
                  value={form.nickname}
                  hasError={Boolean(errors.nickname)}
                  aria-describedby={errors.nickname ? "nickname-error" : undefined}
                  onChange={(e) =>
                    setForm({ ...form, nickname: e.target.value })
                  }
                />
                {errors.nickname && (
                  <p id="nickname-error" className="mt-1.5 text-sm text-red-600 dark:text-red-500">
                    {errors.nickname}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={form.merchantId}
                  onValueChange={(value) =>
                    setForm({ ...form, merchantId: value })
                  }
                >
                  <SelectTrigger id="merchant" className="mt-2">
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
                {errors.merchantId && (
                  <p className="mt-1.5 text-sm text-red-600 dark:text-red-500">
                    {errors.merchantId}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="limit"
                    name="limit"
                    inputMode="decimal"
                    className="mt-2"
                    placeholder="2500.00"
                    value={form.limit}
                    hasError={Boolean(errors.spendLimit)}
                    onChange={(e) => setForm({ ...form, limit: e.target.value })}
                  />
                  {errors.spendLimit && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-500">
                      {errors.spendLimit}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) =>
                      setForm({ ...form, currency: value as Currency })
                    }
                  >
                    <SelectTrigger id="currency" className="mt-2">
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.currency && (
                    <p className="mt-1.5 text-sm text-red-600 dark:text-red-500">
                      {errors.currency}
                    </p>
                  )}
                </div>
              </div>

              {currencyMismatch && merchant && (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {merchant.name} settles in {merchant.currency}. A{" "}
                  {form.currency} card is allowed, but the limit will not match
                  their payouts.
                </p>
              )}

              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Select
                  value={form.categoryLock}
                  onValueChange={(value) =>
                    setForm({ ...form, categoryLock: value as CategoryLock })
                  }
                >
                  <SelectTrigger id="category" className="mt-2">
                    <SelectValue placeholder="No lock" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_LOCKS.map((lock) => (
                      <SelectItem key={lock} value={lock}>
                        {CATEGORY_LOCK_LABELS[lock]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} disabled={submitting}>
                {submitting ? "Issuing" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
