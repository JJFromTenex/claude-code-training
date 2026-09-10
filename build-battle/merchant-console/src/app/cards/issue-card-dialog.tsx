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
import { Card, Currency } from "@/data/types"
import {
  CARD_CATEGORIES,
  CARD_CATEGORY_LABELS,
  CARD_CURRENCIES,
  MAX_SPEND_LIMIT,
  NICKNAME_MAX_LENGTH,
  formatCardNumber,
} from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Check, Copy, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * The issue-a-card dialog (NWP-201), built on Drawer: focus trap, focus
 * return, Escape, and an accessible name come with it.
 *
 * Money: ops types "250" or "250.00"; the existing boundary parser turns it
 * into minor units exactly once, here, and the request carries an integer.
 * The server validates it again — this component is a convenience, not the
 * enforcement.
 *
 * Reveal once: the number arrives in the creation response, is shown on the
 * success screen, and is dropped from state the moment the drawer closes.
 */

type MerchantOption = { id: string; name: string; currency: Currency }
type Issued = { card: Card; number: string }

const NO_CATEGORY = "none"

export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState<string>(NO_CATEGORY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  const [copied, setCopied] = useState(false)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setCurrency("USD")
    setLimit("")
    setCategory(NO_CATEGORY)
    setSubmitting(false)
    setError(null)
    setIssued(null)
    setCopied(false)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    // Closing clears the number from client state. It is not kept anywhere.
    if (!next) reset()
  }

  // Picking a merchant defaults the currency to theirs, so issuing a GBP card
  // to a US merchant takes a deliberate second choice rather than a slip.
  const chooseMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter the spend limit as an amount like 250 or 250.00.")
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
          categoryLock: category === NO_CATEGORY ? null : category,
        }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok) {
        setError(body?.error ?? "Could not issue the card. Try again.")
        return
      }
      setIssued(body as Issued)
      router.refresh()
    } catch {
      setError("Could not reach the console. Check the connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued.number)
      setCopied(true)
    } catch {
      setError("Copy did not work here. Select the number and copy it by hand.")
    }
  }

  const merchantName = (id: string) =>
    merchants.find((m) => m.id === id)?.name ?? id

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
                Copy the number now. This is the only time it is shown; the
                console keeps the last four.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-6">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-xl tracking-wider text-gray-900 dark:text-gray-50">
                  {formatCardNumber(issued.number)}
                </p>
                <Button
                  variant="secondary"
                  className="mt-3 gap-2 py-1"
                  onClick={copy}
                >
                  {copied ? (
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy number"}
                </Button>
                <p role="status" aria-live="polite" className="sr-only">
                  {copied ? "Card number copied" : ""}
                </p>
              </div>

              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Detail label="Nickname">{issued.card.nickname}</Detail>
                <Detail label="Merchant">
                  {merchantName(issued.card.merchantId)}
                </Detail>
                <Detail label="Spend limit">
                  {formatMoney(issued.card.spendLimit, issued.card.currency)}{" "}
                  <span className="text-gray-500">{issued.card.currency}</span>
                </Detail>
                <Detail label="Category lock">
                  {issued.card.categoryLock
                    ? CARD_CATEGORY_LABELS[issued.card.categoryLock]
                    : "Any"}
                </Detail>
              </dl>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" className="mt-2 w-full sm:mt-0 sm:w-fit" asChild>
                  <Link href={`/cards/${issued.card.id}`}>View card</Link>
                </Button>
              </DrawerClose>
              <DrawerClose asChild>
                <Button className="w-full sm:w-fit">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form
            id="issue-card-form"
            onSubmit={submit}
            className="flex flex-1 flex-col"
            noValidate
          >
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, with a limit from the moment
                it exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="card-nickname" className={labelClass}>
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={NICKNAME_MAX_LENGTH}
                  placeholder="Meta ads, Q3"
                  autoComplete="off"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="card-merchant" className={labelClass}>
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={chooseMerchant}>
                  <SelectTrigger id="card-merchant">
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

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_8rem]">
                <div className="space-y-1.5">
                  <label htmlFor="card-limit" className={labelClass}>
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    name="spendLimit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="250.00"
                    autoComplete="off"
                    aria-describedby="card-limit-hint"
                    required
                  />
                  <p id="card-limit-hint" className="text-xs text-gray-500">
                    Up to {formatMoney(MAX_SPEND_LIMIT, currency)}.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="card-currency" className={labelClass}>
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger id="card-currency">
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

              <div className="space-y-1.5">
                <label htmlFor="card-category" className={labelClass}>
                  Category lock
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="card-category" aria-describedby="card-category-hint">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Any category</SelectItem>
                    {CARD_CATEGORIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {CARD_CATEGORY_LABELS[code]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id="card-category-hint" className="text-xs text-gray-500">
                  Optional. Restricts where the card can be used.
                </p>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-2 w-full sm:mt-0 sm:w-fit"
                >
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                className="w-full sm:w-fit"
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

const labelClass = "block text-sm font-medium text-gray-900 dark:text-gray-50"

function Detail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-gray-500">{label}</dt>
      <dd className="mt-0.5 text-gray-900 dark:text-gray-50">{children}</dd>
    </div>
  )
}
