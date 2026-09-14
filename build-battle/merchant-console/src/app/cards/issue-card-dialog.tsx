"use client"

import { Button } from "@/components/Button"
import {
  Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerDescription,
  DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { Card, CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS, MAX_SPEND_LIMIT, maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }
type Issued = { card: Card; number: string }

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-gray-50">{label}</label>
      {children}
    </div>
  )
}

/** Server validates; the number is shown once and dropped on close; a per-open idempotency key stops double issue. */
export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const ids = useId()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [nickname, setNickname] = useState("")
  const [category, setCategory] = useState<CardCategory>("any")
  const [limit, setLimit] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)

  const merchant = merchants.find((m) => m.id === merchantId)
  // Issued in the merchant's settlement currency; the server rejects anything else.
  const currency: Currency = merchant?.currency ?? "USD"

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (next) return setKey(crypto.randomUUID())
    setMerchantId(""); setNickname(""); setCategory("any"); setLimit("")
    setError(null); setIssued(null); setSubmitting(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) return setError("Enter the limit as an amount like 250 or 250.00.")
    setSubmitting(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId, nickname, category, spendLimit, currency, idempotencyKey: key }),
      })
      const data: Partial<Issued> & { error?: string; replayed?: boolean } = await res.json().catch(() => ({}))
      if (!res.ok || !data.card) return setError(data.error ?? "The card was not issued. Try again.")
      if (!data.number) return setError(`${data.card.nickname} was already issued as ${maskCardNumber(data.card.last4)}.`)
      setIssued({ card: data.card, number: data.number })
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button variant="primary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                Copy the number now. It is shown once and cannot be retrieved again; after this it
                appears everywhere as {maskCardNumber(issued.card.last4)}.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wide text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-xl tracking-widest text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
              </div>
              <p className="text-sm text-gray-900 dark:text-gray-50">
                {issued.card.nickname} · {formatMoney(issued.card.spendLimit, issued.card.currency)} {issued.card.currency} · ref{" "}
                <span className="font-mono">{issued.card.numberRef}</span>
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild><Button variant="primary">Done</Button></DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>The card is active the moment it is created, with the limit you set here.</DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <Field id={`${ids}-merchant`} label="Merchant">
                <Select value={merchantId} onValueChange={setMerchantId} required>
                  <SelectTrigger id={`${ids}-merchant`} className="w-full"><SelectValue placeholder="Choose a merchant" /></SelectTrigger>
                  <SelectContent>{merchants.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field id={`${ids}-nickname`} label="Nickname">
                <Input id={`${ids}-nickname`} value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="e.g. Google Ads" maxLength={60} required />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field id={`${ids}-limit`} label="Spend limit">
                    <Input id={`${ids}-limit`} inputMode="decimal" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="250.00" aria-describedby={`${ids}-limit-help`} required />
                    <p id={`${ids}-limit-help`} className="text-xs text-gray-500">Up to {formatMoney(MAX_SPEND_LIMIT, currency)}.</p>
                  </Field>
                </div>
                <Field id={`${ids}-currency`} label="Currency">
                  <Input id={`${ids}-currency`} value={currency} readOnly aria-describedby={`${ids}-currency-help`} />
                  <p id={`${ids}-currency-help`} className="text-xs text-gray-500">{merchant ? `${merchant.name} settles in ${currency}.` : "Set by the merchant."}</p>
                </Field>
              </div>
              <Field id={`${ids}-category`} label="Merchant category lock">
                <Select value={category} onValueChange={(v) => setCategory(v as CardCategory)}>
                  <SelectTrigger id={`${ids}-category`} className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{CARD_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CARD_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-400">{error}</p>}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild><Button variant="secondary" type="button">Cancel</Button></DrawerClose>
              <Button type="submit" variant="primary" isLoading={submitting} loadingText="Issuing">Issue card</Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
