"use client"

import { Button } from "@/components/Button"
import {
  Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerDescription,
  DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/Select"
import { CardCategory } from "@/data/types"
import { CATEGORY_LABELS } from "@/lib/card-labels"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue a card.
 *
 * The form collects strings; the server validates them and generates the
 * number. The revealed number lives in this component's state only while the
 * success screen is open and is cleared on close — it is never stored.
 */

/** A labelled row. Every control in this form has a real <label for>. */
function Field({
  id, label, children, className = "space-y-1.5",
}: {
  id: string
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-gray-50">
        {label}
      </label>
      {children}
    </div>
  )
}

export function IssueCardDialog({
  merchants, categories, currencies,
}: {
  merchants: { id: string; name: string; currency: string }[]
  categories: CardCategory[]
  currencies: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    nickname: "", merchantId: "", limit: "", currency: "USD", category: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<{ number: string; nickname: string } | null>(null)
  // One key per opened form: a double-submit reuses it and the server returns
  // the card it already issued rather than issuing a second one.
  const [key, setKey] = useState(() => crypto.randomUUID())

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))

  const reset = () => {
    setForm({ nickname: "", merchantId: "", limit: "", currency: "USD", category: "" })
    setError(null)
    setBusy(false)
    setRevealed(null)
    setKey(crypto.randomUUID())
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const spendLimit = parseAmountToMinorUnits(form.limit)
    if (spendLimit === null) {
      setError("Enter a spend limit like 2500 or 2500.00.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify({
          nickname: form.nickname,
          merchantId: form.merchantId,
          spendLimit,
          currency: form.currency,
          category: form.category || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "The card could not be issued.")
        return
      }
      if (payload.alreadyIssued) {
        setError("That card was already issued. Its number was shown once and cannot be shown again.")
        router.refresh()
        return
      }
      setRevealed({ number: payload.number, nickname: payload.card.nickname })
      router.refresh()
    } catch {
      setError("Could not reach the server. Nothing was issued.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        // Closing discards the revealed number. There is no way back to it.
        if (!next) reset()
        setOpen(next)
      }}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-md">
        {revealed ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription className="text-sm">
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">{revealed.nickname}</p>
              <p
                className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50"
                aria-label="Full card number, shown once"
              >
                {revealed.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
              </p>
              <p className="text-sm text-gray-500">
                Everywhere else this card shows as •••• {revealed.number.slice(-4)}.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="py-1.5">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                Single merchant, always virtual, limit set at issue.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              <Field id="nickname" label="Nickname">
                <Input
                  id="nickname"
                  value={form.nickname}
                  onChange={(e) => set({ nickname: e.target.value })}
                  placeholder="Ad spend — Q3"
                  required
                />
              </Field>

              <Field id="merchant" label="Merchant">
                <Select value={form.merchantId} onValueChange={(merchantId) => set({ merchantId })}>
                  <SelectTrigger id="merchant" className="w-full">
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

              <div className="flex gap-3">
                <Field id="limit" label="Spend limit" className="flex-1 space-y-1.5">
                  <Input
                    id="limit"
                    inputMode="decimal"
                    value={form.limit}
                    onChange={(e) => set({ limit: e.target.value })}
                    placeholder="2500.00"
                    required
                  />
                </Field>
                <Field id="currency" label="Currency" className="w-32 space-y-1.5">
                  <Select value={form.currency} onValueChange={(currency) => set({ currency })}>
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field id="category" label="Category lock">
                <Select
                  value={form.category || "none"}
                  onValueChange={(v) => set({ category: v === "none" ? "" : v })}
                >
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category lock</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter className="gap-2">
              <DrawerClose asChild>
                <Button type="button" variant="secondary" className="py-1.5">Cancel</Button>
              </DrawerClose>
              <Button type="submit" className="py-1.5" disabled={busy} isLoading={busy}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
