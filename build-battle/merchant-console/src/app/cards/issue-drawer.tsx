"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
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
import { Card, Currency, MerchantCategory } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { CreditCard, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  utilities: "Utilities",
  office_supplies: "Office supplies",
}

export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<MerchantCategory | "none">("none")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Set only on success — this is the one and only time the full number is shown.
  const [issued, setIssued] = useState<{ card: Card; number: string } | null>(
    null,
  )

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("none")
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Refresh the list if a card was issued while the drawer was open.
      if (issued) router.refresh()
      reset()
    }
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          limit,
          currency,
          category: category === "none" ? null : category,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? "Could not issue the card.")
        return
      }
      setIssued({ card: data.card, number: data.number })
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
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
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>
            {issued ? "Card issued" : "Issue a virtual card"}
          </DrawerTitle>
        </DrawerHeader>

        {issued ? (
          <>
            <DrawerBody className="space-y-6">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  <CreditCard className="size-4 shrink-0" aria-hidden="true" />
                  {issued.card.nickname}
                </p>
                <p className="mt-3 font-mono text-lg tracking-widest text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(.{4})/g, "$1 ").trim()}
                </p>
                <p className="mt-2 text-sm text-emerald-800 dark:text-emerald-300">
                  This is the only time the full number is shown. After this it
                  is masked everywhere as •••• {issued.card.last4}.
                </p>
              </div>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.spendLimit, issued.card.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Currency</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {issued.card.currency}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <>
            <DrawerBody className="space-y-5">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  className="mt-2"
                  placeholder="e.g. Google Ads"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant" className="mt-2">
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    className="mt-2"
                    inputMode="decimal"
                    placeholder="250.00"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
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
                    value={currency}
                    onValueChange={(v) => setCurrency(v as Currency)}
                  >
                    <SelectTrigger id="card-currency" className="mt-2">
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
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Select
                  value={category}
                  onValueChange={(v) =>
                    setCategory(v as MerchantCategory | "none")
                  }
                >
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lock</SelectItem>
                    {(
                      Object.keys(CATEGORY_LABELS) as MerchantCategory[]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
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
              <Button
                className="gap-2"
                isLoading={submitting}
                disabled={submitting}
                onClick={submit}
              >
                Issue card
              </Button>
            </DrawerFooter>
          </>
        )}
      </DrawerContent>
    </Drawer>
  )
}
