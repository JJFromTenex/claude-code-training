"use client"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import { Card, Currency } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { cx, focusRing } from "@/lib/utils"
import * as DialogPrimitives from "@radix-ui/react-dialog"
import { CreditCard, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue a card.
 *
 * The success screen is the only place the full number is ever shown. It is
 * held in local state for exactly as long as that screen is open and cleared
 * when the dialog closes — there is no way to get it back afterwards, which is
 * the point.
 */

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

/** Categories a card can be locked to. Empty means unrestricted. */
const CATEGORIES = [
  "Advertising",
  "Software & subscriptions",
  "Travel",
  "Contractors",
  "Office supplies",
]

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ card: Card; number: string } | null>(
    null,
  )

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("")
    setError(null)
    setSubmitting(false)
    // The full number goes with it. Nothing keeps a copy.
    setIssued(null)
  }

  const openChangeHandler = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  /** Picking a merchant defaults the currency to the one they settle in. */
  const merchantChangeHandler = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const submitHandler = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // Convert at the boundary, once. The server receives minor units.
    const minorUnits = parseAmountToMinorUnits(limit)
    if (minorUnits === null) {
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
          limit: minorUnits,
          currency,
          category: category || undefined,
        }),
      })

      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "Could not issue the card.")
        return
      }

      setIssued({ card: body.card, number: body.number })
      // The list behind the dialog is a server component; refresh it so the
      // new card is there when the success screen closes.
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogPrimitives.Root open={open} onOpenChange={openChangeHandler}>
      <DialogPrimitives.Trigger asChild>
        <Button variant="primary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DialogPrimitives.Trigger>
      <DialogPrimitives.Portal>
        <DialogPrimitives.Overlay className="fixed inset-0 z-50 bg-black/30" />
        <DialogPrimitives.Content
          className={cx(
            "fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-md border p-4 shadow-lg sm:p-6",
            "border-gray-200 bg-white dark:border-gray-900 dark:bg-[#090E1A]",
            focusRing,
          )}
        >
          {issued ? (
            <RevealOnce
              card={issued.card}
              number={issued.number}
              merchantName={
                merchants.find((m) => m.id === issued.card.merchantId)?.name ??
                issued.card.merchantId
              }
              onDone={() => openChangeHandler(false)}
            />
          ) : (
            <form onSubmit={submitHandler}>
              <DialogPrimitives.Title className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Issue a virtual card
              </DialogPrimitives.Title>
              <DialogPrimitives.Description className="mt-1 text-sm text-gray-500 dark:text-gray-500">
                The card number is shown once, on the next screen. After that
                only the last four are kept.
              </DialogPrimitives.Description>

              <div className="mt-4 flex flex-col gap-4">
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
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="Ad spend — Q3"
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
                  <select
                    id="card-merchant"
                    name="merchantId"
                    value={merchantId}
                    onChange={(e) => merchantChangeHandler(e.target.value)}
                    className={cx(
                      "mt-2 w-full rounded-md border px-3 py-2 shadow-sm outline-none sm:text-sm",
                      "border-gray-300 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
                      focusRing,
                    )}
                  >
                    <option value="">Choose a merchant</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </option>
                    ))}
                  </select>
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
                      name="limit"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value)}
                      placeholder="2500.00"
                      inputMode="decimal"
                      className="mt-2"
                    />
                  </div>
                  <div className="w-28">
                    <label
                      htmlFor="card-currency"
                      className="text-sm font-medium text-gray-900 dark:text-gray-50"
                    >
                      Currency
                    </label>
                    <select
                      id="card-currency"
                      name="currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className={cx(
                        "mt-2 w-full rounded-md border px-3 py-2 shadow-sm outline-none sm:text-sm",
                        "border-gray-300 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
                        focusRing,
                      )}
                    >
                      {CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="card-category"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Category lock{" "}
                    <span className="font-normal text-gray-500">optional</span>
                  </label>
                  <select
                    id="card-category"
                    name="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className={cx(
                      "mt-2 w-full rounded-md border px-3 py-2 shadow-sm outline-none sm:text-sm",
                      "border-gray-300 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50",
                      focusRing,
                    )}
                  >
                    <option value="">Unrestricted</option>
                    {CATEGORIES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400"
                >
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:justify-end sm:space-x-2 dark:border-gray-900">
                <DialogPrimitives.Close asChild>
                  <Button variant="secondary" className="py-1.5" type="button">
                    Cancel
                  </Button>
                </DialogPrimitives.Close>
                <Button
                  variant="primary"
                  className="py-1.5"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Issuing…" : "Issue card"}
                </Button>
              </div>
            </form>
          )}
        </DialogPrimitives.Content>
      </DialogPrimitives.Portal>
    </DialogPrimitives.Root>
  )
}

/**
 * The one screen that shows a full card number. Closing it is irreversible,
 * so it says so.
 */
function RevealOnce({
  card,
  number,
  merchantName,
  onDone,
}: {
  card: Card
  number: string
  merchantName: string
  onDone: () => void
}) {
  const grouped = number.replace(/(\d{4})(?=\d)/g, "$1 ")

  return (
    <div>
      <DialogPrimitives.Title className="text-base font-semibold text-gray-900 dark:text-gray-50">
        Card issued
      </DialogPrimitives.Title>
      <DialogPrimitives.Description className="mt-1 text-sm text-gray-500 dark:text-gray-500">
        This is the only time the full number is shown. Copy it now — after you
        close this, only {maskCardNumber(card.last4)} is kept.
      </DialogPrimitives.Description>

      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
        <div className="flex items-center gap-2 text-gray-500">
          <CreditCard className="size-4 shrink-0" aria-hidden="true" />
          <span className="text-sm">{card.nickname}</span>
        </div>
        <p className="mt-2 font-mono text-lg font-medium tracking-wider text-gray-900 tabular-nums dark:text-gray-50">
          {grouped}
        </p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500">Merchant</dt>
          <dd className="text-gray-900 dark:text-gray-50">{merchantName}</dd>
          <dt className="text-gray-500">Spend limit</dt>
          <dd className="text-gray-900 tabular-nums dark:text-gray-50">
            {formatMoney(card.limit, card.currency)} {card.currency}
          </dd>
          {card.category && (
            <>
              <dt className="text-gray-500">Category lock</dt>
              <dd className="text-gray-900 dark:text-gray-50">{card.category}</dd>
            </>
          )}
        </dl>
      </div>

      <div className="mt-6 flex justify-end border-t border-gray-200 pt-4 dark:border-gray-900">
        <Button variant="primary" className="py-1.5" onClick={onDone}>
          Done — hide the number
        </Button>
      </div>
    </div>
  )
}
