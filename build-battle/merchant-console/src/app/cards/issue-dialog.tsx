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
import { Card, Currency, MerchantCategory } from "@/data/types"
import { maskedNumber } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]
const CATEGORIES: { value: MerchantCategory; label: string }[] = [
  { value: "any", label: "Any category" },
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel" },
  { value: "office", label: "Office" },
  { value: "contractors", label: "Contractors" },
]

type SuccessState = { card: Card; full: string }

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [category, setCategory] = useState<MerchantCategory>("any")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<SuccessState | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("USD")
    setCategory("any")
    setError(null)
    setSuccess(null)
    setSubmitting(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      // Clearing state on close is what makes reveal-once real: the full
      // number lives only in this component's memory for one dialog session.
      reset()
      if (success) router.refresh()
    }
  }

  const submit = async () => {
    setError(null)
    if (!nickname.trim()) return setError("Nickname is required")
    if (!merchantId) return setError("Pick a merchant")
    const limit = parseAmountToMinorUnits(limitInput)
    if (limit === null || limit <= 0) {
      return setError("Limit must be a positive amount like 250.00")
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          limit,
          currency,
          category,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "Something went wrong")
        setSubmitting(false)
        return
      }
      setSuccess({ card: payload.card, full: payload.full })
    } catch {
      setError("Network error — try again")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="gap-2 py-1.5">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {success ? "Card issued" : "Issue a virtual card"}
          </DrawerTitle>
          <DrawerDescription>
            {success
              ? "This number will not be shown again. Copy it now."
              : "Nickname, merchant, and a spend limit. The card is issued on the 4242 test BIN."}
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-4">
          {success ? (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
                <p className="font-medium">Full number — shown once</p>
                <p
                  className="mt-2 font-mono text-lg tracking-wider"
                  aria-label="Full card number"
                >
                  {success.full.replace(/(.{4})/g, "$1 ").trim()}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-50">
                    {success.card.nickname}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Masked</dt>
                  <dd className="mt-0.5 font-mono text-gray-900 dark:text-gray-50">
                    {maskedNumber(success.card.last4)}
                  </dd>
                </div>
              </dl>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <div>
                <label
                  htmlFor="card-nickname"
                  className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Meta Ads · Q3"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(value) => {
                    setMerchantId(value)
                    const m = merchants.find((m) => m.id === value)
                    if (m) setCurrency(m.currency)
                  }}
                >
                  <SelectTrigger id="card-merchant" aria-label="Merchant">
                    <SelectValue placeholder="Select a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="card-limit"
                    className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    inputMode="decimal"
                    value={limitInput}
                    onChange={(event) => setLimitInput(event.target.value)}
                    placeholder="2500.00"
                  />
                </div>
                <div>
                  <label
                    htmlFor="card-currency"
                    className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(v) => setCurrency(v as Currency)}
                  >
                    <SelectTrigger id="card-currency" aria-label="Currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="mb-1 block text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant category lock
                </label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as MerchantCategory)}
                >
                  <SelectTrigger id="card-category" aria-label="Category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900 dark:border-red-800 dark:bg-red-950 dark:text-red-100"
                >
                  {error}
                </p>
              )}
            </form>
          )}
        </DrawerBody>

        <DrawerFooter>
          {success ? (
            <DrawerClose asChild>
              <Button>Done</Button>
            </DrawerClose>
          ) : (
            <>
              <DrawerClose asChild>
                <Button variant="secondary">Cancel</Button>
              </DrawerClose>
              <Button disabled={submitting} onClick={submit}>
                {submitting ? "Issuing..." : "Issue card"}
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
