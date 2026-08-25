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
import { CARD_CATEGORIES, CARD_CATEGORY_LABELS } from "@/data/cards"
import { CardCategory, Currency } from "@/data/types"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issues a card and shows its number once.
 *
 * The number never leaves this component: it is held only while the success
 * screen is open and cleared when the drawer closes, so nothing can re-read
 * it. The card number itself is generated on the server; nothing here invents
 * one, and every check below is repeated by the route handler, which is where
 * the enforcement lives.
 */

type MerchantOption = { id: string; name: string; currency: Currency }

export function IssueCardDrawer({
  merchants,
}: {
  merchants: MerchantOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [merchantId, setMerchantId] = useState("")
  const [nickname, setNickname] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<CardCategory>("advertising")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fullNumber, setFullNumber] = useState<string | null>(null)
  // One token per attempt at issuing a card, kept across a failed retry so a
  // second submit of the same intent cannot produce a second card.
  const [requestId, setRequestId] = useState("")

  const merchant = merchants.find((option) => option.id === merchantId) ?? null
  // The card settles in the merchant's currency. It is derived here rather
  // than chosen, and checked again on the server.
  const currency = merchant?.currency ?? null
  const limit = parseAmountToMinorUnits(amount)

  const reset = () => {
    setMerchantId("")
    setNickname("")
    setAmount("")
    setCategory("advertising")
    setError(null)
    setFullNumber(null)
    setPending(false)
  }

  const onOpenChange = (next: boolean) => {
    if (next) {
      reset()
      setRequestId(crypto.randomUUID())
    } else {
      // Closing is what ends the reveal: the number is gone from state and
      // there is nowhere left to read it from. The list was already refreshed
      // when the card was issued, so closing stays a pure client change and
      // does not restart a render underneath the drawer's exit animation.
      reset()
    }
    setOpen(next)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!merchant || !currency || limit === null) return

    setPending(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId,
          nickname,
          merchantId: merchant.id,
          limit,
          currency,
          category,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "The card could not be issued.")
        return
      }
      setFullNumber(body.fullNumber ?? null)
      // Refresh behind the success screen, so the card is already in the list
      // by the time the drawer closes.
      router.refresh()
    } catch {
      setError("Could not reach the server. The card was not issued.")
    } finally {
      setPending(false)
    }
  }

  const amountInvalid = amount.trim() !== "" && limit === null
  const canSubmit =
    Boolean(merchant) && nickname.trim() !== "" && limit !== null

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">Issue card</Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-lg">
        <DrawerHeader>
          <DrawerTitle>
            {fullNumber ? "Card issued" : "Issue a virtual card"}
          </DrawerTitle>
          <DrawerDescription>
            {fullNumber
              ? "This is the only time the full number is shown."
              : "Single-merchant, virtual, and limited from the moment it exists."}
          </DrawerDescription>
        </DrawerHeader>

        {fullNumber ? (
          <>
            <DrawerBody className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-lg tracking-widest text-gray-900 dark:text-gray-50">
                  {fullNumber.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Copy it now. Once this closes the console keeps the last four
                only, and nothing can show it again.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerBody className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
                >
                  {error}
                </div>
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
                  placeholder="Ad spend Q3"
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
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="card-merchant" className="mt-2">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name} · {option.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit
                </label>
                <Input
                  id="card-limit"
                  name="limit"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="250.00"
                  hasError={amountInvalid}
                  aria-describedby="card-limit-hint"
                  className="mt-2"
                />
                <p id="card-limit-hint" className="mt-1 text-sm text-gray-500">
                  {amountInvalid
                    ? "Enter an amount like 250 or 250.00."
                    : currency
                      ? `In ${currency}, the currency ${merchant?.name} settles in. Up to ${formatMoney(5_000_000, currency)}.`
                      : "Choose a merchant first: the card settles in their currency."}
                </p>
              </div>

              <div>
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
                  <SelectTrigger id="card-category" className="mt-2">
                    <SelectValue placeholder="Choose a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {CARD_CATEGORY_LABELS[option]}
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
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit || pending}>
                {pending ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
