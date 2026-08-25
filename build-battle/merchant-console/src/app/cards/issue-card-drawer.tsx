"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
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
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { FormEvent, useId, useState } from "react"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  shipping: "Shipping",
  office: "Office",
  travel: "Travel",
}

type MerchantOption = { id: string; name: string; currency: Currency }

interface IssuedCard {
  card: Card
  fullNumber: string
}

interface FormState {
  nickname: string
  merchantId: string
  limitInput: string
  currency: Currency
  category: CardCategory
}

function initialFormFor(merchants: MerchantOption[]): FormState {
  const first = merchants[0]
  return {
    nickname: "",
    merchantId: first?.id ?? "",
    limitInput: "",
    currency: first?.currency ?? "USD",
    category: CARD_CATEGORIES[0],
  }
}

/** Groups a card number into blocks of four for readability: "4242 1234 5678 9012". */
function groupInFours(value: string): string {
  return value.replace(/(.{4})/g, "$1 ").trim()
}

export function IssueCardDrawer({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(() => initialFormFor(merchants))
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<IssuedCard | null>(null)

  const nicknameId = useId()
  const merchantFieldId = useId()
  const limitId = useId()
  const currencyId = useId()
  const categoryId = useId()

  const selectedMerchant = merchants.find((m) => m.id === form.merchantId)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // The PAN must never survive in state after the drawer closes.
      setForm(initialFormFor(merchants))
      setError(null)
      setSubmitting(false)
      setIssued(null)
      router.refresh()
    }
  }

  const handleMerchantChange = (id: string) => {
    const merchant = merchants.find((m) => m.id === id)
    setForm((f) => ({
      ...f,
      merchantId: id,
      currency: merchant ? merchant.currency : f.currency,
    }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return

    setError(null)

    if (!form.merchantId) {
      setError("Choose a merchant.")
      return
    }
    const limitMinorUnits = parseAmountToMinorUnits(form.limitInput)
    if (limitMinorUnits === null) {
      setError("Enter a valid spend limit, like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          limitMinorUnits,
          currency: form.currency,
          category: form.category,
        }),
      })

      const body = await response.json().catch(() => null)

      if (!response.ok) {
        setError(body?.message ?? "Could not issue the card.")
        setSubmitting(false)
        return
      }

      setIssued(body as IssuedCard)
      setSubmitting(false)
    } catch {
      setError("Could not reach the server. Try again.")
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button>Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">
                This is the only time the full card number is shown. Write it
                down now — it cannot be retrieved again.
              </p>
              <p
                className="rounded-md border border-gray-300 bg-gray-50 p-3 text-center font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50"
                aria-label="Full card number"
              >
                {groupInFours(issued.fullNumber)}
              </p>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {issued.card.nickname}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500">Limit</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.limitMinorUnits, issued.card.currency)}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              {error && (
                <p className="rounded-md bg-red-50 p-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-400">
                  {error}
                </p>
              )}

              <div>
                <label
                  htmlFor={nicknameId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id={nicknameId}
                  className="mt-1"
                  value={form.nickname}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, nickname: event.target.value }))
                  }
                  placeholder="Ad spend — Q3"
                  maxLength={60}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={merchantFieldId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={form.merchantId} onValueChange={handleMerchantChange}>
                  <SelectTrigger id={merchantFieldId} className="mt-1">
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
                  htmlFor={limitId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit ({selectedMerchant?.currency ?? form.currency})
                </label>
                <Input
                  id={limitId}
                  className="mt-1"
                  inputMode="decimal"
                  value={form.limitInput}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, limitInput: event.target.value }))
                  }
                  placeholder="250.00"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor={currencyId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Currency
                </label>
                <Select
                  value={form.currency}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, currency: value as Currency }))
                  }
                >
                  <SelectTrigger id={currencyId} className="mt-1">
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

              <div>
                <label
                  htmlFor={categoryId}
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category
                </label>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm((f) => ({ ...f, category: value as CardCategory }))
                  }
                >
                  <SelectTrigger id={categoryId} className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button">
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
