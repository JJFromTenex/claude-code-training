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
import { Card, CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES } from "@/lib/cards"
import { CURRENCIES, formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }

type Issued = { card: Card; number: string }

const EMPTY_FORM = {
  nickname: "",
  merchantId: "",
  spendLimit: "",
  currency: "USD" as Currency,
  category: "general" as CardCategory,
}

/**
 * The issue form and its success screen. The full card number lives in
 * component state between the creation response and the drawer closing,
 * and nowhere else. Closing the drawer drops it.
 */
export function IssueCardDrawer({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setIssued(null)
      setError(null)
      setCopied(false)
      setForm(EMPTY_FORM)
    }
  }

  const update = (changes: Partial<typeof form>) =>
    setForm((current) => ({ ...current, ...changes }))

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    // Convert the typed amount once, here at the boundary. The server
    // validates the integer it receives; this is only so ops can type 250.00.
    const spendLimit = parseAmountToMinorUnits(form.spendLimit)
    if (spendLimit === null) {
      setError("Enter the spend limit as an amount like 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit,
          currency: form.currency,
          category: form.category,
        }),
      })
      const body = (await response.json().catch(() => null)) as
        Issued | { message?: string } | null
      if (!response.ok || !body || !("card" in body)) {
        setError(
          (body && "message" in body && body.message) ||
            "The card could not be issued. Try again.",
        )
        return
      }
      setIssued(body)
      router.refresh()
    } catch {
      setError("The console could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const copyNumber = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.number)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                {issued.card.nickname} is active with a{" "}
                {formatMoney(issued.card.spendLimit, issued.card.currency)}{" "}
                limit.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">
                This is the only time the full number is shown. Once this panel
                closes it is masked everywhere, and it cannot be retrieved
                again.
              </p>
              <p
                className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50"
                aria-label="Full card number"
              >
                {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
              </p>
              <Button
                variant="secondary"
                className="py-1.5"
                onClick={copyNumber}
              >
                {copied ? "Copied" : "Copy number"}
              </Button>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="w-full sm:w-fit">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, limited from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  required
                  maxLength={40}
                  value={form.nickname}
                  onChange={(event) => update({ nickname: event.target.value })}
                  placeholder="Ad spend · Meta"
                  className="mt-1"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) => {
                    const merchant = merchants.find((m) => m.id === merchantId)
                    update({
                      merchantId,
                      currency: merchant?.currency ?? form.currency,
                    })
                  }}
                >
                  <SelectTrigger id="card-merchant" className="mt-1">
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

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    name="spendLimit"
                    inputMode="decimal"
                    required
                    value={form.spendLimit}
                    onChange={(event) =>
                      update({ spendLimit: event.target.value })
                    }
                    placeholder="250.00"
                    className="mt-1"
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
                    value={form.currency}
                    onValueChange={(currency) =>
                      update({ currency: currency as Currency })
                    }
                  >
                    <SelectTrigger id="card-currency" className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="-mt-2 text-xs text-gray-500">
                Up to {formatMoney(5_000_000, form.currency)}. The limit cannot
                be changed after issue.
              </p>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant category lock
                </label>
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    update({ category: category as CardCategory })
                  }
                >
                  <SelectTrigger id="card-category" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem
                        key={category}
                        value={category}
                        className="capitalize"
                      >
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-500"
                >
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button
                  variant="secondary"
                  className="w-full sm:w-fit"
                  type="button"
                >
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                className="w-full sm:w-fit"
                isLoading={submitting}
                loadingText="Issuing"
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
