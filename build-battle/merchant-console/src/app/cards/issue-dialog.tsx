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
import { Currency } from "@/data/types"
import { formatCardNumber, MAX_SPEND_LIMIT } from "@/lib/cards"
import { CURRENCIES, formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }

export function IssueCardDialog({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The one-time reveal. Cleared when the drawer closes — never re-readable.
  const [issued, setIssued] = useState<{
    number: string
    nickname: string
    spendLimit: number
    currency: Currency
  } | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Refresh the list behind the drawer, then drop the number from memory.
      if (issued) router.refresh()
      reset()
    }
  }

  // Ops types "2500" or "2500.00"; minor units are what leave the browser.
  const minorUnits = parseAmountToMinorUnits(limit)
  const limitLooksValid =
    minorUnits !== null && minorUnits > 0 && minorUnits <= MAX_SPEND_LIMIT
  const canSubmit =
    nickname.trim().length > 0 && merchantId !== "" && limitLooksValid

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!canSubmit || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit: minorUnits,
          currency,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "The card could not be issued.")
        return
      }
      setIssued({
        number: payload.number,
        nickname: payload.card.nickname,
        spendLimit: payload.card.spendLimit,
        currency: payload.card.currency,
      })
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
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                everywhere else this card is masked.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500">{issued.nickname}</p>
                <p className="mt-2 font-mono text-xl tracking-wider text-gray-900 tabular-nums dark:text-gray-50">
                  {formatCardNumber(issued.number)}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  Limit {formatMoney(issued.spendLimit, issued.currency)}{" "}
                  {issued.currency}
                </p>
              </div>
              <p className="text-sm text-orange-700 dark:text-orange-500">
                Closing this panel discards the number. It cannot be shown
                again.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, spend-capped from the moment it exists. The
                number is generated on the server.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
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
                  autoComplete="off"
                  required
                />
                <p className="text-xs text-gray-500">
                  What this card pays for. Ops sees this in the list.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="card-merchant"
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
                  <SelectTrigger id="card-merchant" className="w-full">
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
                <div className="flex flex-1 flex-col gap-2">
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
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="2500.00"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className="flex w-28 flex-col gap-2">
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
                    <SelectTrigger id="card-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="-mt-3 text-xs text-gray-500">
                {limit && !limitLooksValid
                  ? minorUnits === null
                    ? "Enter an amount like 2500 or 2500.00."
                    : minorUnits <= 0
                      ? "The limit must be greater than zero."
                      : `The limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, currency)}.`
                  : `Maximum ${formatMoney(MAX_SPEND_LIMIT, currency)}.`}
              </p>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
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
                disabled={!canSubmit}
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
