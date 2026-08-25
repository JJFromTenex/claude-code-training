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
import { CardCategory, Currency } from "@/data/types"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORIES: { value: CardCategory; label: string }[] = [
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel" },
  { value: "office", label: "Office" },
  { value: "other", label: "Other" },
]

/** Mirrors the server ceiling so the form can say so before a round trip. */
const MAX_SPEND_LIMIT = 5_000_000

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

export function IssueCardDrawer({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [nickname, setNickname] = React.useState("")
  const [merchantId, setMerchantId] = React.useState("")
  const [limit, setLimit] = React.useState("")
  const [currency, setCurrency] = React.useState<Currency>("USD")
  const [category, setCategory] = React.useState<string>("")
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  /**
   * The full number, held only between the creation response and the moment
   * this drawer closes. Nothing writes it anywhere else.
   */
  const [revealed, setRevealed] = React.useState<{
    cardNumber: string
    nickname: string
  } | null>(null)

  /** Held across retries of one form, cleared when the drawer closes. */
  const idempotencyKey = React.useRef<string | null>(null)

  /** Whatever happens, the number does not survive the drawer closing. */
  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setRevealed(null)
      setNickname("")
      setMerchantId("")
      setLimit("")
      setCurrency("USD")
      setCategory("")
      setError(null)
      idempotencyKey.current = null
    }
  }

  /** Picking a merchant defaults the currency to the one they settle in. */
  function handleMerchantChange(id: string) {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // Convert at the boundary, once. The server re-checks everything.
    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter the limit as an amount, like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      // One key per filled-in form, so a double submit cannot make two cards.
      const key = idempotencyKey.current ?? crypto.randomUUID()
      idempotencyKey.current = key

      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": key,
        },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          category: category || null,
        }),
      })

      const body = await response.json()

      if (!response.ok) {
        setError(body.message ?? "That card could not be issued.")
        return
      }

      setRevealed({ cardNumber: body.cardNumber, nickname: body.card.nickname })
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {revealed ? (
          <>
            <DrawerHeader>
              <DrawerTitle>{revealed.nickname} is live</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                everywhere else it is masked.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <p className="text-sm text-gray-500">Card number</p>
              <p className="mt-1 font-mono text-xl tracking-wider text-gray-900 dark:text-gray-50">
                {revealed.cardNumber.replace(/(.{4})/g, "$1 ").trim()}
              </p>
              <p className="mt-6 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                Once you close this, the number cannot be retrieved. The card
                record keeps only the last four.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, live with a limit from the
                moment it exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200"
                >
                  {error}
                </p>
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
                  className="mt-2"
                  placeholder="Vendor subscriptions"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={handleMerchantChange}>
                  <SelectTrigger id="merchant" className="mt-2">
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
                    htmlFor="limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="limit"
                    name="limit"
                    className="mt-2"
                    inputMode="decimal"
                    placeholder="250.00"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Up to {formatMoney(MAX_SPEND_LIMIT, currency)} per card.
                  </p>
                </div>

                <div className="w-32">
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  {/*
                    Not a choice: a card settles in its merchant's currency and
                    the server refuses anything else. Showing a picker here
                    would be offering a decision that cannot be made.
                  */}
                  <Input
                    id="currency"
                    className="mt-2"
                    value={currency}
                    readOnly
                    aria-describedby="currency-hint"
                  />
                  <p id="currency-hint" className="mt-1 text-xs text-gray-500">
                    {merchantId ? "Set by the merchant." : "Pick a merchant."}
                  </p>
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
                  <SelectTrigger id="category" className="mt-2">
                    <SelectValue placeholder="No restriction" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((option) => (
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
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
