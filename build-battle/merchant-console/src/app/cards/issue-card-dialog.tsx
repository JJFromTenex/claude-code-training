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
import { CARD_CATEGORIES, CardCategory, Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  retail: "Retail",
  travel: "Travel",
  dining: "Dining",
  software: "Software",
  other: "Other",
}

type Result = { last4: string; number: string; nickname: string }

const EMPTY_FORM = {
  nickname: "",
  merchantId: "",
  limitInput: "",
  category: "none" as CardCategory | "none",
}

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  const nicknameId = useId()
  const merchantFieldId = useId()
  const limitId = useId()
  const currencyFieldId = useId()
  const categoryFieldId = useId()

  // Currency is the merchant's own — every payment in this app already
  // derives currency from the merchant rather than asking (src/data/generate.ts),
  // and a card in a currency its merchant doesn't operate in would be a real bug.
  const selectedMerchant = merchants.find((m) => m.id === form.merchantId)
  const currency = selectedMerchant?.currency ?? null

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      const created = result !== null
      setForm(EMPTY_FORM)
      setError(null)
      setResult(null)
      if (created) router.refresh()
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!form.merchantId || !currency) {
      setError("Select a merchant.")
      return
    }
    const spendLimit = parseAmountToMinorUnits(form.limitInput)
    if (spendLimit === null) {
      setError("Enter a valid spend limit, like 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit,
          currency,
          category: form.category === "none" ? null : form.category,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(body.error ?? "Could not issue the card.")
        return
      }
      setResult({ last4: body.card.last4, number: body.number, nickname: body.card.nickname })
    } catch {
      setError("Could not reach the server.")
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = result ? result.number.replace(/(\d{4})(?=\d)/g, "$1 ") : ""

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full sm:w-fit">Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {result ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <p className="font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                {grouped}
              </p>
              <p className="text-sm text-gray-500">
                {result.nickname} · ends {result.last4}
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Generated on the 4242 test BIN. The full number is shown once, right after this.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={nicknameId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id={nicknameId}
                  value={form.nickname}
                  onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
                  placeholder="Ad spend – Q3"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={merchantFieldId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) => setForm((f) => ({ ...f, merchantId }))}
                >
                  <SelectTrigger id={merchantFieldId} className="w-full">
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

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={limitId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit
                </label>
                <Input
                  id={limitId}
                  inputMode="decimal"
                  value={form.limitInput}
                  onChange={(e) => setForm((f) => ({ ...f, limitInput: e.target.value }))}
                  placeholder="250.00"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={currencyFieldId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Currency
                </label>
                <Input
                  id={currencyFieldId}
                  value={currency ?? ""}
                  placeholder="Set by the selected merchant"
                  readOnly
                  disabled
                />
                <p className="text-xs text-gray-500">
                  Follows the merchant — a card can&apos;t be issued in a currency its merchant
                  doesn&apos;t operate in.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor={categoryFieldId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category <span className="text-gray-500">(optional)</span>
                </label>
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    setForm((f) => ({ ...f, category: category as CardCategory | "none" }))
                  }
                >
                  <SelectTrigger id={categoryFieldId} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category</SelectItem>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-500" role="alert">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" disabled={submitting} isLoading={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
