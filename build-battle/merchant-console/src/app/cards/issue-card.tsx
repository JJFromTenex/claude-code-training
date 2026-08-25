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
import { parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CATEGORIES = [
  { value: "", label: "None" },
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel" },
  { value: "supplies", label: "Supplies" },
  { value: "services", label: "Services" },
  { value: "other", label: "Other" },
] as const

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: string }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [category, setCategory] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealNumber, setRevealNumber] = useState<string | null>(null)

  const selectedMerchant = merchants.find((m) => m.id === merchantId)
  const currency = selectedMerchant?.currency ?? "USD"

  function reset() {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCategory("")
    setError(null)
    setRevealNumber(null)
    setSubmitting(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    setOpen(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const minorUnits = parseAmountToMinorUnits(limitInput)
    if (minorUnits === null || minorUnits <= 0) {
      setError("Enter a valid spend limit (e.g. 500.00).")
      setSubmitting(false)
      return
    }

    const idempotencyKey = crypto.randomUUID()

    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit: minorUnits,
          currency,
          category: category || null,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.message || "Failed to issue card.")
        setSubmitting(false)
        return
      }

      setRevealNumber(data.fullNumber ?? null)
      setSubmitting(false)
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
      setSubmitting(false)
    }
  }

  if (revealNumber) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerTrigger asChild>
          <Button className="w-full gap-2 py-1.5 sm:w-fit">
            <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
            Issue card
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Card issued</DrawerTitle>
            <DrawerDescription>
              Copy the card number now. It will not be shown again.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-sm text-gray-500">Card number</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-wider text-gray-900 dark:text-gray-50">
                {revealNumber}
              </p>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                This is the only time this number will be displayed.
              </p>
            </div>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button>Done</Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <form onSubmit={handleSubmit}>
          <DrawerHeader>
            <DrawerTitle>Issue a virtual card</DrawerTitle>
            <DrawerDescription>
              Create a new virtual card for a merchant.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="e.g. Ad spend"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <select
                  id="card-merchant"
                  value={merchantId}
                  onChange={(e) => setMerchantId(e.target.value)}
                  required
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none transition dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                >
                  <option value="">Select a merchant</option>
                  {merchants.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="card-limit"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit ({currency})
                </label>
                <Input
                  id="card-limit"
                  type="text"
                  inputMode="decimal"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="500.00"
                  className="mt-1"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="block text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category (optional)
                </label>
                <select
                  id="card-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm shadow-sm outline-none transition dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </div>
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="secondary" type="button">Cancel</Button>
            </DrawerClose>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Issuing..." : "Issue card"}
            </Button>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  )
}
