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
import { CARD_CATEGORIES, CARD_CURRENCIES, FieldErrors } from "@/data/cards"
import { Card, CardCategory, Currency } from "@/data/types"
import { formatCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }

const EMPTY = {
  nickname: "",
  merchantId: "",
  amount: "",
  currency: "USD" as Currency,
  category: "" as CardCategory | "",
}

/**
 * The issue form and the one-time reveal. The number arrives in the creation
 * response, lives in this component's state while the success screen is
 * open, and is dropped on close. Nothing else ever holds it.
 */
export function IssueCard({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<FieldErrors & { form?: string }>({})
  const [pending, setPending] = useState(false)
  const [issued, setIssued] = useState<{ card: Card; cardNumber: string } | null>(null)
  // One key per attempt: a double-click or a retried request cannot issue twice.
  const [attemptKey, setAttemptKey] = useState(() => crypto.randomUUID())

  const minorUnits = parseAmountToMinorUnits(form.amount)
  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }))
    // A corrected field drops its error immediately; the server re-checks on submit.
    setErrors((e) => {
      const next = { ...e }
      for (const key of Object.keys(patch)) {
        delete next[(key === "amount" ? "spendLimit" : key) as keyof typeof next]
      }
      return next
    })
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setIssued(null)
      setErrors({})
      setForm(EMPTY)
      setAttemptKey(crypto.randomUUID())
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setPending(true)
    setErrors({})
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": attemptKey },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit: minorUnits,
          currency: form.currency,
          category: form.category,
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (response.status === 400 && body.errors) {
        setErrors(body.errors)
      } else if (!response.ok || !body.cardNumber) {
        setErrors({ form: body.error ?? "The card was not issued. Try again." })
      } else {
        setIssued({ card: body.card, cardNumber: body.cardNumber })
        router.refresh()
      }
    } catch {
      setErrors({ form: "Could not reach the server. Nothing was issued." })
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="gap-1.5">
          <Plus className="size-4" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now; from
                here on the console shows the last four only.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">{issued.card.nickname}</p>
              <p className="font-mono text-2xl tracking-wider text-gray-900 dark:text-gray-50">
                {formatCardNumber(issued.cardNumber)}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Limit {formatMoney(issued.card.spendLimit, issued.card.currency)}{" "}
                {issued.card.currency} · {issued.card.category}
              </p>
              <Button
                variant="secondary"
                onClick={() => navigator.clipboard?.writeText(issued.cardNumber)}
              >
                Copy number
              </Button>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <Field label="Nickname" id="card-nickname" error={errors.nickname}>
                <Input
                  id="card-nickname"
                  value={form.nickname}
                  onChange={(e) => set({ nickname: e.target.value })}
                  placeholder="Meta ads · Q3"
                  hasError={Boolean(errors.nickname)}
                />
              </Field>
              <Field label="Merchant" id="card-merchant" error={errors.merchantId}>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) => {
                    const merchant = merchants.find((m) => m.id === merchantId)
                    set({ merchantId, currency: merchant?.currency ?? form.currency })
                  }}
                >
                  <SelectTrigger id="card-merchant" hasError={Boolean(errors.merchantId)}>
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} · {m.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field
                    label="Spend limit"
                    id="card-limit"
                    error={errors.spendLimit}
                    hint={
                      minorUnits === null
                        ? "An amount like 250 or 250.00"
                        : `${formatMoney(minorUnits, form.currency)} · ${minorUnits.toLocaleString("en-US")} minor units`
                    }
                  >
                    <Input
                      id="card-limit"
                      inputMode="decimal"
                      value={form.amount}
                      onChange={(e) => set({ amount: e.target.value })}
                      placeholder="250.00"
                      hasError={Boolean(errors.spendLimit)}
                    />
                  </Field>
                </div>
                <Field label="Currency" id="card-currency" error={errors.currency}>
                  <Select
                    value={form.currency}
                    onValueChange={(currency) => set({ currency: currency as Currency })}
                  >
                    <SelectTrigger id="card-currency" hasError={Boolean(errors.currency)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field
                label="Category lock"
                id="card-category"
                error={errors.category}
                hint="The card only works for this kind of spend."
              >
                <Select
                  value={form.category}
                  onValueChange={(category) => set({ category: category as CardCategory })}
                >
                  <SelectTrigger id="card-category" hasError={Boolean(errors.category)}>
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {errors.form && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {errors.form}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" isLoading={pending}>
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
  label,
  id,
  error,
  hint,
  children,
}: {
  label: string
  id: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-gray-50">
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600 dark:text-red-500">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  )
}
