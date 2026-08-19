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
import { CATEGORIES, CURRENCIES } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  subscriptions: "Vendor subscriptions",
  advertising: "Ad spend",
  contractors: "Contractor tools",
  travel: "Travel",
  general: "General",
}

type Issued = { card: Card; number: string }

/**
 * Issue a card. Two screens: the form, then a success screen that shows the
 * full number exactly once. Closing the drawer drops `issued` from state, so
 * the number is not sitting in the client after the reveal.
 */
export function IssueCardDialog({ merchants }: { merchants: { id: string; name: string }[] }) {
  const router = useRouter()
  const ids = { nick: useId(), limit: useId(), merchant: useId(), currency: useId(), category: useId() }

  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory>("general")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)

  function reset() {
    setNickname("")
    setMerchantId("")
    setAmount("")
    setCurrency("USD")
    setCategory("general")
    setError(null)
    setIssued(null)
  }

  function onOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      reset() // the one-time reveal ends here
      router.refresh()
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Client-side convenience only. The server re-validates everything.
    const limit = parseAmountToMinorUnits(amount)
    if (limit === null) {
      setError("Enter a limit like 250 or 250.00.")
      return
    }

    setBusy(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ merchantId, nickname, limit, currency, category }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<Issued> & { error?: string }
      if (!res.ok || !data.card || !data.number) {
        setError(data.error ?? "Could not issue the card.")
        return
      }
      setIssued({ card: data.card, number: data.number })
    } catch {
      setError("Could not reach the server.")
    } finally {
      setBusy(false)
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
      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now; after you close this it
                appears as •••• {issued.card.last4} everywhere.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wide text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-xl tabular-nums tracking-widest text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-50">{issued.card.nickname}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.limit, issued.card.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-50">
                    {CATEGORY_LABELS[issued.card.category]}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Status</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-50">Active</dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="w-full sm:w-fit">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, virtual, with a limit from the moment it exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div>
                <label htmlFor={ids.nick} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Nickname
                </label>
                <Input
                  id={ids.nick}
                  className="mt-1"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Ad spend — Q3"
                  maxLength={60}
                  required
                />
              </div>

              <div>
                <label htmlFor={ids.merchant} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id={ids.merchant} className="mt-1">
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
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label htmlFor={ids.limit} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Spend limit
                  </label>
                  <Input
                    id={ids.limit}
                    className="mt-1"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="250.00"
                    required
                  />
                </div>
                <div>
                  <label htmlFor={ids.currency} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Currency
                  </label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                    <SelectTrigger id={ids.currency} className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label htmlFor={ids.category} className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant category lock
                </label>
                <Select value={category} onValueChange={(v) => setCategory(v as CardCategory)}>
                  <SelectTrigger id={ids.category} className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error ? (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              ) : null}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button" className="w-full sm:w-fit">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" className="w-full sm:w-fit" disabled={busy || !merchantId}>
                {busy ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
