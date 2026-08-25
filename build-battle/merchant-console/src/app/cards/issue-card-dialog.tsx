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
import { CARD_CATEGORIES, CATEGORY_LABELS, maskLast4 } from "@/lib/cards"
import { Card, CardCategory, Currency } from "@/data/types"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type MerchantOption = { id: string; name: string; currency: Currency }

/**
 * Issues a card. Submitting shows a one-time success screen with the full
 * number — the reveal (`.claude/rules/cards.md`). Closing the drawer clears
 * that number out of state; it does not come back.
 */
export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState<CardCategory>("software")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ card: Card; number: string } | null>(null)
  // One key per open drawer: a double-click or a retried request during that
  // one submission reuses it, so the server answers with the same card
  // instead of minting a second one.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())

  const selectedMerchant = merchants.find((m) => m.id === merchantId)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCategory("software")
    setError(null)
    setIssued(null)
    setIdempotencyKey(crypto.randomUUID())
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedMerchant) {
      setError("Choose a valid merchant.")
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit: limit,
          currency: selectedMerchant.currency,
          category,
          idempotencyKey,
        }),
      })
      const body = await response.json()
      if (!response.ok) {
        setError(body.message ?? "Could not issue the card.")
        return
      }
      setIssued({ card: body.card, number: body.number })
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

      <DrawerContent className="sm:max-w-md">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now — after
                this it is masked everywhere, including here.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs text-gray-500">{issued.card.nickname}</p>
                <p className="mt-1 font-mono text-lg tracking-wider text-gray-900 dark:text-gray-50">
                  {issued.number}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                From now on this card shows as{" "}
                <span className="font-mono">{maskLast4(issued.card.last4)}</span>.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Creates a virtual card on the 4242 test BIN with the limit set below.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-nickname" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  required
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Ad spend — Q3"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-merchant" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId} required>
                  <SelectTrigger id="card-merchant">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  {selectedMerchant
                    ? `Issued in ${selectedMerchant.currency} — the merchant's own currency.`
                    : "The card's currency follows the merchant you pick."}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-limit" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Spend limit {selectedMerchant ? `(${selectedMerchant.currency})` : ""}
                </label>
                <Input
                  id="card-limit"
                  required
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  placeholder="250.00"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="card-category" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Category
                </label>
                <Select value={category} onValueChange={(v) => setCategory(v as CardCategory)}>
                  <SelectTrigger id="card-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p className="text-sm text-red-600 dark:text-red-500" role="alert">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
