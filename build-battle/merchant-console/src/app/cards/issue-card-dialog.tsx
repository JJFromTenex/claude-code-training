"use client"

import { FormEvent, ReactNode, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
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
import { merchants } from "@/data/merchants"
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS, CardCategory } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"

type FieldErrors = Partial<
  Record<"nickname" | "merchantId" | "limit" | "currency" | "category" | "form", string>
>

const emptyForm = {
  nickname: "",
  merchantId: "",
  limitInput: "",
  category: "" as CardCategory | "",
}

export function IssueCardDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ number: string; last4: string } | null>(null)

  const selectedMerchant = merchants.find((m) => m.id === form.merchantId) ?? null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setForm(emptyForm)
      setErrors({})
      setResult(null)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()

    const limit = parseAmountToMinorUnits(form.limitInput)
    const clientErrors: FieldErrors = {}
    if (!form.nickname.trim()) clientErrors.nickname = "Nickname is required."
    if (!selectedMerchant) clientErrors.merchantId = "Choose a merchant."
    if (limit == null || limit <= 0) {
      clientErrors.limit = "Enter a limit greater than zero, like 250.00."
    }
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors)
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          merchantId: form.merchantId,
          limit,
          currency: selectedMerchant?.currency,
          category: form.category || null,
        }),
      })
      const body = await res.json()
      if (!res.ok) {
        setErrors(body.errors ?? { form: body.error ?? "Could not issue the card." })
        return
      }
      setResult({ number: body.number, last4: body.card.last4 })
      router.refresh()
    } catch {
      setErrors({ form: "Could not reach the server. Try again." })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="gap-2">
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
                This is the only time the full number is shown. Everywhere
                else, it&apos;s masked as •••• {result.last4}.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
                {result.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, always virtual. The limit is set now and
                can&apos;t be changed after issue.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              {errors.form && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {errors.form}
                </p>
              )}

              <Field label="Nickname" htmlFor="card-nickname" error={errors.nickname}>
                <Input
                  id="card-nickname"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  placeholder="Ad spend — Q3"
                  hasError={Boolean(errors.nickname)}
                />
              </Field>

              <Field label="Merchant" htmlFor="card-merchant" error={errors.merchantId}>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) => setForm({ ...form, merchantId })}
                >
                  <SelectTrigger id="card-merchant" hasError={Boolean(errors.merchantId)}>
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
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Spend limit" htmlFor="card-limit" error={errors.limit}>
                  <Input
                    id="card-limit"
                    inputMode="decimal"
                    value={form.limitInput}
                    onChange={(e) => setForm({ ...form, limitInput: e.target.value })}
                    placeholder="250.00"
                    hasError={Boolean(errors.limit)}
                  />
                </Field>
                <Field label="Currency" htmlFor="card-currency" error={errors.currency}>
                  <Select value={selectedMerchant?.currency ?? ""} disabled>
                    <SelectTrigger id="card-currency">
                      <SelectValue placeholder="Set by merchant" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMerchant && (
                        <SelectItem value={selectedMerchant.currency}>
                          {selectedMerchant.currency}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-gray-500">
                    Matches the merchant&apos;s own currency.
                  </p>
                </Field>
              </div>

              <Field label="Category (optional)" htmlFor="card-category" error={errors.category}>
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    setForm({ ...form, category: category as CardCategory })
                  }
                >
                  <SelectTrigger id="card-category">
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CARD_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-gray-900 dark:text-gray-50"
      >
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>
      )}
    </div>
  )
}
