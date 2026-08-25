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
import { CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, CARD_CURRENCIES, formatCardNumber } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  contractors: "Contractors",
  travel: "Travel",
  other: "Other",
}

/**
 * Issue a card, then reveal its number exactly once.
 *
 * The number arrives in the creation response and lives in this component's
 * state until the drawer closes. It is never written anywhere, and closing
 * the drawer is the last time anyone can read it.
 */
export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<CardCategory>("other")

  const [issued, setIssued] = useState<{ number: string; last4: string } | null>(
    null,
  )

  const limitMinorUnits = parseAmountToMinorUnits(limit)
  const limitInvalid = limit !== "" && limitMinorUnits === null

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("other")
    setError(null)
    setIssued(null)
  }

  const close = (next: boolean) => {
    setOpen(next)
    // The reveal is over the moment the drawer closes.
    if (!next) reset()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (limitMinorUnits === null) {
      setError("Enter a spend limit like 250 or 250.00.")
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
          spendLimit: limitMinorUnits,
          currency,
          category,
        }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.message ?? "The card could not be issued.")
      }

      setIssued({ number: body.number, last4: body.card.last4 })
      router.refresh()
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The card could not be issued.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={close}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue a card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                everywhere else the card reads •••• {issued.last4}.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                Card number
              </p>
              <p className="mt-1 font-mono text-2xl tabular-nums text-gray-900 dark:text-gray-50">
                {formatCardNumber(issued.number)}
              </p>
              <p className="mt-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                Closing this drawer discards the number. It is not stored and it
                cannot be shown again.
              </p>
            </DrawerBody>

            <DrawerFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, with a limit from the moment it exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
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
                  placeholder="Ad spend — Q4"
                  required
                  maxLength={60}
                  className="mt-1.5"
                />
              </div>

              <div>
                <label
                  htmlFor="merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <select
                  id="merchant"
                  name="merchantId"
                  value={merchantId}
                  required
                  onChange={(event) => {
                    setMerchantId(event.target.value)
                    const picked = merchants.find(
                      (m) => m.id === event.target.value,
                    )
                    if (picked) setCurrency(picked.currency)
                  }}
                  className="mt-1.5 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                >
                  <option value="">Choose a merchant</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="limit"
                    name="limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="2500.00"
                    required
                    hasError={limitInvalid}
                    aria-describedby="limit-hint"
                    className="mt-1.5"
                  />
                  <p
                    id="limit-hint"
                    className="mt-1 text-xs text-gray-500 dark:text-gray-500"
                  >
                    {limitInvalid
                      ? "Enter an amount like 250 or 250.00."
                      : "Up to 50,000.00 per card."}
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <select
                    id="currency"
                    name="currency"
                    value={currency}
                    onChange={(event) =>
                      setCurrency(event.target.value as Currency)
                    }
                    className="mt-1.5 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                  >
                    {CARD_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <select
                  id="category"
                  name="category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as CardCategory)
                  }
                  className="mt-1.5 block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                >
                  {CARD_CATEGORIES.map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_LABELS[value]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
                  The card can only be used for this category.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
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
