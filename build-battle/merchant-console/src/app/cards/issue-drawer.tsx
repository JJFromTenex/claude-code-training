"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
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
import { Card, CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, mask } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

const CATEGORY_LABELS: Record<CardCategory, string> = {
  retail: "Retail",
  marketplace: "Marketplace",
  subscription: "Subscription",
  services: "Services",
}

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

interface IssueDrawerProps {
  merchants: MerchantOption[]
}

interface RevealState {
  card: Card
  cardNumber: string
}

export function IssueDrawer({ merchants }: IssueDrawerProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [category, setCategory] = useState<CardCategory | "">("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency | "">("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reveal, setReveal] = useState<RevealState | null>(null)

  const spendLimit = parseAmountToMinorUnits(limitInput)
  const canSubmit =
    !submitting &&
    nickname.trim().length > 0 &&
    merchantId.length > 0 &&
    (CARD_CATEGORIES as readonly string[]).includes(category) &&
    (CURRENCIES as string[]).includes(currency) &&
    spendLimit !== null &&
    spendLimit > 0 &&
    spendLimit <= 5_000_000

  const resetForm = () => {
    setNickname("")
    setMerchantId("")
    setCategory("")
    setLimitInput("")
    setCurrency("")
    setError(null)
    setReveal(null)
    setSubmitting(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) resetForm()
  }

  const submit = async () => {
    if (!canSubmit || spendLimit === null) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchantId,
          nickname: nickname.trim(),
          spendLimit,
          currency,
          category,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body?.error ?? "Something went wrong")
        setSubmitting(false)
        return
      }
      setReveal({ card: body.card, cardNumber: body.cardNumber })
      setSubmitting(false)
      router.refresh()
    } catch {
      setError("Network error. Try again.")
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
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader>
          <DrawerTitle>
            {reveal ? "Card issued" : "Issue a virtual card"}
          </DrawerTitle>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            {reveal
              ? "Copy the full number now. It will not be shown again."
              : "Cards are virtual, single-merchant, and carry a limit from the moment they exist."}
          </p>
        </DrawerHeader>
        <DrawerBody className="space-y-5">
          {reveal ? (
            <>
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Full card number
                </p>
                <p className="mt-1 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                  {reveal.cardNumber.match(/.{1,4}/g)?.join(" ")}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-50">
                    {reveal.card.nickname}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Masked</dt>
                  <dd className="font-mono text-gray-900 dark:text-gray-50">
                    {mask(reveal.card.last4)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Limit</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-50">
                    {formatMoney(reveal.card.spendLimit, reveal.card.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Category</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-50">
                    {CATEGORY_LABELS[reveal.card.category]}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="e.g. Ad spend"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(value) => {
                    setMerchantId(value)
                    const match = merchants.find((m) => m.id === value)
                    if (match && !currency) setCurrency(match.currency)
                  }}
                >
                  <SelectTrigger id="card-merchant">
                    <SelectValue placeholder="Pick a merchant" />
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

              <div className="space-y-1.5">
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as CardCategory)}
                >
                  <SelectTrigger id="card-category">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {CATEGORY_LABELS[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    value={limitInput}
                    onChange={(event) => setLimitInput(event.target.value)}
                    placeholder="250.00"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                  <p className="text-xs text-gray-500">
                    Max $50,000.00 equivalent (5,000,000 minor units).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger id="card-currency">
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </>
          )}
        </DrawerBody>
        <DrawerFooter>
          {reveal ? (
            <DrawerClose asChild>
              <Button>Done</Button>
            </DrawerClose>
          ) : (
            <>
              <DrawerClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DrawerClose>
              <Button onClick={submit} disabled={!canSubmit}>
                {submitting ? "Issuing..." : "Issue card"}
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
