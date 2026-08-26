"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/Drawer"
import { Input } from "@/components/Input"
import { merchants } from "@/data/merchants"
import { Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { CreditCard } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

type Step = "form" | "success"

// The Tremor/Radix Select doesn't close reliably nested inside a Drawer's
// own dialog layer, leaving a clickable overlay behind (reproduced by hand:
// its listbox stayed data-state="closed" but display:flex indefinitely,
// blocking clicks under it). A native <select> sidesteps that entirely and
// stays just as accessible; styled to match Input's border/focus treatment.
const nativeSelectClass =
  "mt-2 block w-full appearance-none rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm outline-none transition dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"

export function IssueCardDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("form")
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ fullNumber: string; last4: string } | null>(null)

  const reset = () => {
    setStep("form")
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("USD")
    setError(null)
    setResult(null)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      if (step === "success") router.refresh()
      reset()
    }
  }

  const submit = async () => {
    setError(null)
    const limitMinorUnits = parseAmountToMinorUnits(limitInput)
    if (limitMinorUnits === null) {
      setError("Enter a spend limit like 250 or 250.00.")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, merchantId, limitMinorUnits, currency }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.error ?? "Could not issue the card.")
        return
      }
      setResult({ fullNumber: body.fullNumber, last4: body.card.last4 })
      setStep("success")
    } catch {
      setError("Could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <Button
        className="w-full gap-2 py-1.5 sm:w-fit"
        onClick={() => setOpen(true)}
      >
        <CreditCard className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
        Issue card
      </Button>
      <DrawerContent className="sm:max-w-md">
        {step === "form" ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, always virtual, with a limit from the moment
                it exists.
              </DrawerDescription>
            </DrawerHeader>
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
                  placeholder="Ad spend — Q3"
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
                <select
                  id="card-merchant"
                  className={nativeSelectClass}
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                >
                  <option value="" disabled>
                    Select a merchant
                  </option>
                  {merchants.map((merchant) => (
                    <option key={merchant.id} value={merchant.id}>
                      {merchant.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <select
                    id="card-currency"
                    className={nativeSelectClass}
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as Currency)}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DrawerClose>
              <Button
                variant="primary"
                disabled={!nickname || !merchantId || !limitInput || submitting}
                isLoading={submitting}
                loadingText="Issuing…"
                onClick={submit}
              >
                Issue card
              </Button>
            </DrawerFooter>
          </>
        ) : (
          result && (
            <>
              <DrawerHeader>
                <DrawerTitle>Card issued</DrawerTitle>
                <DrawerDescription>
                  This is the only time the full number is shown. It will
                  not appear again.
                </DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <p className="rounded-md border border-gray-200 bg-gray-50 p-4 text-center font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50">
                  {result.fullNumber}
                </p>
                <p className="mt-4 text-sm text-gray-500">
                  Everywhere else, this card shows as •••• {result.last4}.
                </p>
              </DrawerBody>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button variant="primary">Done</Button>
                </DrawerClose>
              </DrawerFooter>
            </>
          )
        )}
      </DrawerContent>
    </Drawer>
  )
}
