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
import { Currency, MerchantCategory } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]
const CATEGORIES: { value: MerchantCategory; label: string }[] = [
  { value: "software", label: "Software" },
  { value: "advertising", label: "Advertising" },
  { value: "travel", label: "Travel" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "other", label: "Other" },
]

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency | "">("")
  const [category, setCategory] = useState<MerchantCategory>("other")
  const [clientError, setClientError] = useState<string | null>(null)
  const [serverErrors, setServerErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [reveal, setReveal] = useState<{ last4: string; number: string } | null>(null)
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  function reset() {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("")
    setCategory("other")
    setClientError(null)
    setServerErrors([])
    setReveal(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setClientError(null)
    setServerErrors([])

    const spendLimit = parseAmountToMinorUnits(limitInput)
    if (spendLimit === null) {
      setClientError("Enter a spend limit like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify({ nickname, merchantId, spendLimit, currency, category }),
      })
      const data = await res.json()
      if (!res.ok) {
        setServerErrors(data.errors ?? ["Something went wrong."])
        return
      }
      // A retried submit under the same key replays the original card without
      // a number to reveal — it was already shown once, on the first response.
      if (data.number) setReveal({ last4: data.card.last4, number: data.number })
      else setOpen(false)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // The full number lives only in this component's state. Any dismissal
        // path — Done, Escape, the overlay, the X — clears it, not just hides it.
        if (!next) reset()
      }}
    >
      <DrawerTrigger asChild>
        <Button className="w-full sm:w-fit">Issue card</Button>
      </DrawerTrigger>
      <DrawerContent>
        {reveal ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">
                This is the only time the full number is shown. It is not stored
                and cannot be retrieved again — everywhere else it reads{" "}
                <span className="font-mono">•••• {reveal.last4}</span>.
              </p>
              <p className="rounded-md border border-gray-200 bg-gray-50 p-3 text-center font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
                {reveal.number}
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              {serverErrors.length > 0 && (
                <ul className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
                  {serverErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              )}
              <Field label="Nickname">
                <Input
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend — Q3"
                />
              </Field>
              <Field label="Merchant">
                <Select
                  value={merchantId}
                  onValueChange={(id) => {
                    setMerchantId(id)
                    const merchant = merchants.find((m) => m.id === id)
                    if (merchant) setCurrency(merchant.currency)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Spend limit">
                <Input
                  required
                  inputMode="decimal"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="250.00"
                />
                {clientError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{clientError}</p>
                )}
              </Field>
              <Field label="Currency">
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a currency" />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Category">
                <Select value={category} onValueChange={(v) => setCategory(v as MerchantCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Cancel</Button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-900 dark:text-gray-50">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  )
}
