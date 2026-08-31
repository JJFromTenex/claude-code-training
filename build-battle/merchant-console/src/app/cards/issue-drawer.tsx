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
import { merchants } from "@/data/merchants"
import { CardCategory } from "@/data/types"
import { CirclePlus, Copy } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { CATEGORY_LABELS } from "./labels"

const CATEGORIES: CardCategory[] = [
  "vendor_subscriptions",
  "ad_spend",
  "contractor_tools",
]

const EMPTY_FORM = { nickname: "", merchantId: "", limit: "", category: "" }

/**
 * Issue a card, then reveal its number exactly once. `number` only ever
 * lives in this component's state, set from the POST response and cleared
 * the moment the drawer closes — reopening it always starts a fresh card.
 */
export function IssueCardDrawer() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ number: string; last4: string } | null>(
    null,
  )
  const [copied, setCopied] = useState(false)

  const merchant = merchants.find((m) => m.id === form.merchantId)

  const reset = () => {
    setForm(EMPTY_FORM)
    setError(null)
    setIssued(null)
    setSubmitting(false)
    setCopied(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset() // closing (X, Escape, overlay, or Done) drops the revealed number for good
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting || !merchant) return
    setSubmitting(true)
    setError(null)

    const response = await fetch("/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nickname: form.nickname,
        merchantId: form.merchantId,
        limit: form.limit,
        currency: merchant.currency,
        category: form.category,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      setError(data.error ?? "Something went wrong issuing this card.")
      setSubmitting(false)
      return
    }

    setIssued({ number: data.number, last4: data.card.last4 })
    setSubmitting(false)
    router.refresh()
  }

  const copyNumber = async () => {
    if (!issued) return
    await navigator.clipboard.writeText(issued.number)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <CirclePlus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                after you close this, every screen shows •••• {issued.last4}.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
                <span className="font-mono text-lg tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </span>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5 py-1.5"
                  onClick={copyNumber}
                >
                  <Copy className="size-3.5 shrink-0" aria-hidden="true" />
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DrawerHeader>
              <DrawerTitle>Issue a card</DrawerTitle>
              <DrawerDescription>
                Single-merchant, always virtual, with a limit from the moment
                it exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  className="mt-1.5"
                  placeholder="e.g. Paid social"
                  value={form.nickname}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nickname: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={form.merchantId}
                  onValueChange={(merchantId) =>
                    setForm((f) => ({ ...f, merchantId }))
                  }
                >
                  <SelectTrigger id="card-merchant" className="mt-1.5">
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

              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Currency
                </span>
                <p className="mt-1.5 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-sm text-gray-500 dark:border-gray-800 dark:bg-gray-900">
                  {merchant
                    ? `${merchant.currency} — matches ${merchant.name}`
                    : "Select a merchant first"}
                </p>
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
                  className="mt-1.5"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.limit}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, limit: e.target.value }))
                  }
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category
                </label>
                <Select
                  value={form.category}
                  onValueChange={(category) =>
                    setForm((f) => ({ ...f, category }))
                  }
                >
                  <SelectTrigger id="card-category" className="mt-1.5">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
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
              <Button type="submit" isLoading={submitting} loadingText="Issuing…">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
