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
import { Card, Currency } from "@/data/types"
import { CARD_CURRENCIES, MAX_SPEND_LIMIT } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * The success screen is the only place the full number ever appears. It is
 * held in component state, shown once, and dropped when the drawer closes —
 * nothing refetches it because nothing stores it.
 */
type Issued = { card: Card; number: string }

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<Issued | null>(null)

  const parsedLimit = parseAmountToMinorUnits(limit)
  const limitValid =
    parsedLimit !== null && parsedLimit > 0 && parsedLimit <= MAX_SPEND_LIMIT
  const valid = nickname.trim() !== "" && merchantId !== "" && limitValid

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setError(null)
    setIssued(null)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next && issued) {
      // The number is gone the moment this closes. Refresh so the new card
      // shows up in the list behind it.
      router.refresh()
    }
    if (next) reset()
  }

  // Picking a merchant defaults the currency to the one it trades in.
  const onMerchantChange = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit: parsedLimit,
          currency,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.message ?? "The card could not be issued.")
        return
      }
      setIssued({ card: body.card, number: body.number })
    } catch {
      setError("The card could not be issued. Check your connection.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">Issue card</Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>{issued ? "Card issued" : "Issue a card"}</DrawerTitle>
        </DrawerHeader>

        {issued ? (
          <>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">
                This is the only time the full number is shown. Copy it now —
                after this the card shows its last four only.
              </p>
              <p
                className="rounded-md bg-gray-50 p-3 font-mono text-lg tracking-widest text-gray-900 dark:bg-gray-900 dark:text-gray-50"
                aria-label="Full card number, shown once"
              >
                {issued.number.replace(/(.{4})/g, "$1 ").trim()}
              </p>
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {issued.card.nickname}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.spendLimit, issued.card.currency)}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
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
                  className="mt-2"
                  value={nickname}
                  autoComplete="off"
                  placeholder="Meta ad spend"
                  onChange={(event) => setNickname(event.target.value)}
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={onMerchantChange}>
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

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit ({currency})
                </label>
                <Input
                  id="card-limit"
                  className="mt-2"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="500.00"
                  value={limit}
                  hasError={limit !== "" && !limitValid}
                  onChange={(event) => setLimit(event.target.value)}
                />
                {limit !== "" && !limitValid && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                    Enter an amount between 0 and{" "}
                    {formatMoney(MAX_SPEND_LIMIT, currency)}.
                  </p>
                )}
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
                  onValueChange={(next) => setCurrency(next as Currency)}
                >
                  <SelectTrigger id="card-currency" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!valid}
                isLoading={submitting}
                loadingText="Issuing"
              >
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
