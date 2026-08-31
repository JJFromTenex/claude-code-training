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
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS } from "@/lib/cards"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue a virtual card (NWP-201).
 *
 * The number is generated on the server and shown here exactly once. It lives
 * in component state only while the success view is open, and closing the
 * drawer clears it — there is no way back to it from the UI or the API.
 */

type Merchant = { id: string; name: string; currency: string }

export function IssueCardDialog({
  merchants,
  currencies,
}: {
  merchants: Merchant[]
  currencies: readonly string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [spendLimit, setSpendLimit] = useState("")
  const [currency, setCurrency] = useState(currencies[0] ?? "USD")
  const [categoryLock, setCategoryLock] = useState<string>("any")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ number: string; last4: string } | null>(
    null,
  )

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setSpendLimit("")
    setCurrency(currencies[0] ?? "USD")
    setCategoryLock("any")
    setError(null)
    setSubmitting(false)
    setIssued(null)
  }

  const close = () => {
    setOpen(false)
    // Drop the number on the way out. It is not recoverable after this.
    reset()
    router.refresh()
  }

  /**
   * A card settles in its merchant's currency, so picking a merchant sets it.
   * The server enforces the same rule; this only keeps the field truthful.
   */
  const chooseMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant && currencies.includes(merchant.currency)) {
      setCurrency(merchant.currency)
    }
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          categoryLock,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.message ?? "Could not issue the card.")
        return
      }
      setIssued({ number: body.number, last4: body.card.last4 })
    } catch {
      setError("Could not reach the server. Nothing was issued.")
    } finally {
      setSubmitting(false)
    }
  }

  const grouped = issued?.number.match(/.{1,4}/g)?.join(" ") ?? ""

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
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
          <DrawerDescription className="text-sm">
            {issued
              ? "Copy the number now. This is the only time it is shown."
              : "Single merchant, always virtual, limit set at issue."}
          </DrawerDescription>
        </DrawerHeader>

        {issued ? (
          <>
            <DrawerBody className="space-y-4">
              <div className="rounded-md border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/30">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
                  Card number — shown once
                </p>
                <p className="mt-2 select-all font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {grouped}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Stored on the card record as{" "}
                <span className="font-mono">•••• {issued.last4}</span>. Neither
                the list nor the card detail can show the full number again.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={close}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend — Meta"
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={chooseMerchant}>
                  <SelectTrigger id="card-merchant" className="mt-2">
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

              <div className="flex gap-3">
                <div className="flex-1">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    name="spendLimit"
                    inputMode="decimal"
                    value={spendLimit}
                    onChange={(event) => setSpendLimit(event.target.value)}
                    placeholder="250.00"
                    className="mt-2"
                  />
                </div>
                <div className="w-32">
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select value={currency} disabled>
                    <SelectTrigger id="card-currency" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Set by the merchant.
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select value={categoryLock} onValueChange={setCategoryLock}>
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CARD_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-xs text-gray-500">
                  Fixed at issue. Editing a card after issue is NWP-202.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-500/40 bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={close}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} loadingText="Issuing">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
