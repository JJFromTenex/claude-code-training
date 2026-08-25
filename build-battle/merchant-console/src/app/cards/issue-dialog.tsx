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
import { Card, CardCategory, Currency } from "@/data/types"
import {
  CARD_CATEGORIES,
  CARD_CURRENCIES,
  formatCardNumber,
  maskCardNumber,
} from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

/** What the server hands back once, and only once. */
interface Issued {
  card: Card
  number: string
}

export function IssueCardDialog({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [spendLimit, setSpendLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [categoryLock, setCategoryLock] = useState<CardCategory | "">("")

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)

  const merchant = merchants.find((m) => m.id === merchantId)
  // Ops picks a merchant far more often than a currency, and a card in the
  // wrong one is a support ticket. Follow the merchant, stay overridable.
  const currencyMismatch = merchant ? merchant.currency !== currency : false

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setSpendLimit("")
    setCurrency("USD")
    setCategoryLock("")
    setError(null)
    setSubmitting(false)
    // The number lives exactly as long as the screen showing it.
    setIssued(null)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const chooseMerchant = (id: string) => {
    setMerchantId(id)
    const picked = merchants.find((m) => m.id === id)
    if (picked) setCurrency(picked.currency)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    // Guard the second click: a card issued twice is a real card too.
    if (submitting) return

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
          categoryLock: categoryLock || null,
        }),
      })
      const payload = await response.json()

      if (!response.ok) {
        setError(payload?.error ?? "Could not issue the card.")
        return
      }

      setIssued(payload as Issued)
      // Refresh underneath, so the list behind this screen is already right.
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

      <DrawerContent>
        {issued ? (
          <IssuedCardReveal
            issued={issued}
            merchantName={
              merchants.find((m) => m.id === issued.card.merchantId)?.name ?? ""
            }
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The full number is shown once, right after it is issued.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="flex flex-col gap-5">
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
                  placeholder="Ad spend — search"
                  className="mt-2"
                  maxLength={60}
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
                    {merchants.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
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
              </div>

              {currencyMismatch && merchant && (
                <p className="-mt-2 text-sm text-amber-600 dark:text-amber-500">
                  {merchant.name} settles in {merchant.currency}. Issuing in{" "}
                  {currency} is allowed, but check it is what you meant.
                </p>
              )}

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock{" "}
                  <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <Select
                  value={categoryLock}
                  onValueChange={(next) =>
                    setCategoryLock(next === "none" ? "" : (next as CardCategory))
                  }
                >
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue placeholder="No lock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No lock</SelectItem>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-sm text-gray-500">
                  Locked at issue. Changing it later is NWP-202.
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/50 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary" disabled={submitting}>
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                isLoading={submitting}
                loadingText="Issuing..."
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

/**
 * The one screen in the console that shows a full card number. Closing it
 * drops the number from React state, and no later request can produce it.
 */
function IssuedCardReveal({
  issued,
  merchantName,
  onDone,
}: {
  issued: Issued
  merchantName: string
  onDone: () => void
}) {
  const { card, number } = issued

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Card issued</DrawerTitle>
        <DrawerDescription>
          Copy the number now. It is not shown again, and it is not stored.
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody className="flex flex-col gap-5">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/40">
          <p className="text-sm text-blue-900 dark:text-blue-300">
            Full number — shown once
          </p>
          <p className="mt-2 select-all font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
            {formatCardNumber(number)}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Field label="Nickname">{card.nickname}</Field>
          <Field label="Merchant">{merchantName}</Field>
          <Field label="Spend limit">
            {formatMoney(card.spendLimit, card.currency)}
          </Field>
          <Field label="Currency">{card.currency}</Field>
          <Field label="Everywhere else">
            <span className="font-mono">{maskCardNumber(card.last4)}</span>
          </Field>
          <Field label="Reference">
            <span className="font-mono text-xs">{card.reference}</span>
          </Field>
        </dl>
      </DrawerBody>

      <DrawerFooter>
        <Button onClick={onDone}>Done</Button>
      </DrawerFooter>
    </>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
        {children}
      </dd>
    </div>
  )
}
