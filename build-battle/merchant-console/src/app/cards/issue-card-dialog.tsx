"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
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
import { Card, Currency, MerchantCategory } from "@/data/types"
import { formatMoney } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue form and the one-time reveal.
 *
 * The full number lives in this component's state only while the success
 * screen is open, and is dropped when it closes. It is never re-fetchable:
 * no route returns it a second time.
 */

export function IssueCardDialog({
  merchants,
  categories,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
  categories: { value: MerchantCategory; label: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ card: Card; number: string } | null>(
    null,
  )

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<string>("")

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("")
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  const close = (next: boolean) => {
    setOpen(next)
    // Dropping the reveal on close is the point: it cannot be read again.
    if (!next) reset()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          // Sent as typed. The server converts to minor units, once.
          spendLimit: limit,
          currency,
          category: category || null,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setError(payload.message ?? "Could not issue the card.")
        return
      }

      setIssued({ card: payload.card, number: payload.reveal.number })
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and retry.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={close}>
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
                This is the only time the full number is shown. Copy it now —
                after you close this it is {"••••"}{" "}
                {issued.card.last4} everywhere.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-gray-500">Nickname</dt>
                  <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
                    {issued.card.nickname}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Spend limit</dt>
                  <dd className="mt-1 text-sm tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.spendLimit, issued.card.currency)}{" "}
                    {issued.card.currency}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The number is generated when you submit and shown once.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Google Ads — Q4"
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(next) => {
                    setMerchantId(next)
                    const merchant = merchants.find((m) => m.id === next)
                    if (merchant) setCurrency(merchant.currency)
                  }}
                >
                  <SelectTrigger id="merchant" className="mt-2 w-full">
                    <SelectValue placeholder="Pick a merchant" />
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="limit"
                    name="spendLimit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="2500.00"
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Max {formatMoney(5_000_000, currency)}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(next) => setCurrency(next as Currency)}
                  >
                    <SelectTrigger id="currency" className="mt-2 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["USD", "EUR", "GBP"] as const).map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category" className="mt-2 w-full">
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => close(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting}>
                {submitting ? "Issuing..." : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
