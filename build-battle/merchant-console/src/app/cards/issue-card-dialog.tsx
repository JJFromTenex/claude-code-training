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
import { Currency, MerchantCategory } from "@/data/types"
import { MERCHANT_CATEGORIES, MERCHANT_CATEGORY_LABELS, maskedNumber } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

type Merchant = { id: string; name: string; currency: Currency }

const emptyForm = {
  nickname: "",
  merchantId: "",
  category: "" as MerchantCategory | "",
  limitInput: "",
  currency: "" as Currency | "",
}

export function IssueCardDialog({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ number: string; last4: string } | null>(null)

  const reset = () => {
    setForm(emptyForm)
    setError(null)
    setResult(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Closing discards the full number for good — it is a one-time reveal,
      // not something that survives in client state after the dialog closes.
      reset()
      if (result) router.refresh()
    }
  }

  const handleMerchantChange = (merchantId: string) => {
    const merchant = merchants.find((m) => m.id === merchantId)
    setForm((prev) => ({
      ...prev,
      merchantId,
      currency: merchant?.currency ?? prev.currency,
    }))
  }

  const submit = async () => {
    setError(null)

    if (!form.nickname.trim()) {
      setError("Give the card a nickname.")
      return
    }
    if (!form.merchantId) {
      setError("Choose a merchant.")
      return
    }
    if (!form.category) {
      setError("Choose a merchant category.")
      return
    }
    const limit = parseAmountToMinorUnits(form.limitInput)
    if (limit === null || limit <= 0) {
      setError("Enter a spend limit greater than zero, like 250.00.")
      return
    }
    if (limit > 5_000_000) {
      setError("Spend limit cannot exceed 50,000.00.")
      return
    }
    if (!form.currency) {
      setError("Choose a currency.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          merchantId: form.merchantId,
          category: form.category,
          limit,
          currency: form.currency,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Could not issue the card.")
        return
      }
      setResult({ number: data.number, last4: data.card.last4 })
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = result?.number.replace(/(\d{4})(?=\d)/g, "$1 ")

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        {result ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center font-mono text-lg tracking-wider text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
                {grouped}
              </div>
              <p className="text-sm text-gray-500">
                After you close this, only the masked number ({maskedNumber(result.last4)}) is
                shown anywhere in the console.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, virtual, with a limit from the moment it exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-50">Nickname</span>
                <Input
                  value={form.nickname}
                  onChange={(e) => setForm((p) => ({ ...p, nickname: e.target.value }))}
                  placeholder="Ad spend — Q3 campaign"
                />
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-50">Merchant</span>
                <Select value={form.merchantId} onValueChange={handleMerchantChange}>
                  <SelectTrigger>
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
              </label>

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-gray-900 dark:text-gray-50">
                  Merchant category
                </span>
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    setForm((p) => ({ ...p, category: category as MerchantCategory }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {MERCHANT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {MERCHANT_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>

              <div className="flex gap-3">
                <label className="flex flex-1 flex-col gap-1.5 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-50">
                    Spend limit
                  </span>
                  <Input
                    inputMode="decimal"
                    value={form.limitInput}
                    onChange={(e) => setForm((p) => ({ ...p, limitInput: e.target.value }))}
                    placeholder="250.00"
                  />
                </label>

                <label className="flex w-28 flex-col gap-1.5 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-50">Currency</span>
                  <Select
                    value={form.currency}
                    onValueChange={(currency) =>
                      setForm((p) => ({ ...p, currency: currency as Currency }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((currency) => (
                        <SelectItem key={currency} value={currency}>
                          {currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DrawerClose>
              <Button onClick={submit} isLoading={submitting} loadingText="Issuing…">
                Issue card
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
