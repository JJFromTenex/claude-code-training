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
import type { Currency, MerchantCategory } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

export function IssueCardDialog({
  merchants,
  categories,
}: {
  merchants: { id: string; name: string; currency: string }[]
  categories: readonly MerchantCategory[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<MerchantCategory | "">("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // The full number lives here and only here, until the drawer closes.
  const [issued, setIssued] = useState<{
    cardNumber: string
    nickname: string
  } | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("")
    setError(null)
    setIssued(null)
  }

  const close = (next: boolean) => {
    setOpen(next)
    // Dropping `issued` here is what makes the reveal one-time: the number is
    // never re-fetchable, so once this state is gone it is gone.
    if (!next) reset()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const minorUnits = parseAmountToMinorUnits(limit)
    if (minorUnits === null) {
      setError("Enter the limit as an amount, like 250 or 250.00.")
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
          spendLimit: minorUnits,
          currency,
          category: category || null,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload.message ?? "That card could not be issued.")
        return
      }

      setIssued({ cardNumber: payload.cardNumber, nickname: payload.card.nickname })
      router.refresh()
    } catch {
      setError("Could not reach the server. Try again.")
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

      <DrawerContent className="sm:max-w-md">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription className="text-sm">
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-amber-500/40 bg-amber-50 p-4 dark:bg-amber-950/30">
                <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-500">
                  {issued.nickname}
                </p>
                <p className="mt-2 font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.cardNumber.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                After you close this, the card shows as •••• {issued.cardNumber.slice(-4)}{" "}
                everywhere in the console.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => close(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                Single merchant, with a limit from the moment it exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Google Ads — brand"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <select
                  id="card-merchant"
                  value={merchantId}
                  onChange={(e) => {
                    setMerchantId(e.target.value)
                    const match = merchants.find((m) => m.id === e.target.value)
                    if (match) setCurrency(match.currency as Currency)
                  }}
                  required
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                >
                  <option value="">Select a merchant</option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="250.00"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <select
                    id="card-currency"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                    disabled={Boolean(merchantId)}
                    className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock <span className="text-gray-500">(optional)</span>
                </label>
                <select
                  id="card-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as MerchantCategory | "")
                  }
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                >
                  <option value="">No lock</option>
                  {categories.map((value) => (
                    <option key={value} value={value}>
                      {CATEGORY_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-500/40 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => close(false)}
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
