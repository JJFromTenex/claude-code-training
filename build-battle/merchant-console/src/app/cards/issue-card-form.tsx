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
import { CARD_CATEGORIES, CURRENCIES } from "@/data/cards"
import { CardCategory, Currency } from "@/data/types"
import { maskLast4 } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue a card.
 *
 * The amount is converted to minor units here, at the boundary, by the same
 * helper the rest of the console uses — the form never does arithmetic on a
 * float. Everything it checks, the server checks again; these checks exist to
 * save a round trip, not to enforce anything.
 *
 * The number the server returns is held in component state for one screen and
 * dropped when that screen closes. It is not stored, not put in the URL, and
 * not written anywhere it could be read again.
 */

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  supplies: "Supplies",
}

const NO_CATEGORY = "none"

interface Issued {
  cardNumber: string
  nickname: string
  last4: string
  spendLimit: number
  currency: Currency
}

export function IssueCardForm({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [amount, setAmount] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<string>(NO_CATEGORY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)

  /** Drops the revealed number along with everything else. */
  const reset = () => {
    setNickname("")
    setMerchantId("")
    setAmount("")
    setCurrency("USD")
    setCategory(NO_CATEGORY)
    setError(null)
    setIssued(null)
    setSubmitting(false)
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const onOpenChange = (next: boolean) => {
    if (next) {
      reset()
      setOpen(true)
    } else {
      close()
    }
  }

  const pickMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const spendLimit = parseAmountToMinorUnits(amount)
    if (spendLimit === null) {
      setError("Enter a spend limit as an amount, like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          category: category === NO_CATEGORY ? null : category,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload.error ?? "The card could not be issued.")
        return
      }

      setIssued({
        cardNumber: payload.cardNumber,
        nickname: payload.card.nickname,
        last4: payload.card.last4,
        spendLimit: payload.card.spendLimit,
        currency: payload.card.currency,
      })
      router.refresh()
    } catch {
      setError("Could not reach the server. The card was not issued.")
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

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                after you close this, the card reads {maskLast4(issued.last4)}{" "}
                everywhere.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="text-sm text-gray-500">{issued.nickname}</p>
              <p
                className="mt-2 font-mono text-2xl tabular-nums tracking-wider text-gray-900 dark:text-gray-50"
                aria-label={`Card number ${issued.cardNumber.split("").join(" ")}`}
              >
                {issued.cardNumber.replace(/(.{4})/g, "$1 ").trim()}
              </p>
              <p className="mt-4 text-sm text-gray-500">
                Spend limit {formatMoney(issued.spendLimit, issued.currency)}{" "}
                {issued.currency}
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={close}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
                >
                  {error}
                </p>
              )}

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
                  placeholder="Meta Ads"
                  className="mt-2"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={pickMerchant}>
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
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="250.00"
                    className="mt-2"
                    required
                  />
                </div>
                <div className="w-32">
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
                      {CURRENCIES.map((code) => (
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
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>No lock</SelectItem>
                    {CARD_CATEGORIES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CATEGORY_LABELS[value]}
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
                onClick={close}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Issuing the card"
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
