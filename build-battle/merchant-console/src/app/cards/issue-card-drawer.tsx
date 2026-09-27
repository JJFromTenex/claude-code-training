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
import {
  CARD_CATEGORY_OPTIONS,
  CARD_CURRENCY_OPTIONS,
  maskCardNumber,
} from "@/lib/card-display"
import type { Currency } from "@/data/types"
import { parseAmountToMinorUnits } from "@/lib/money"
import { Check, Copy, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

type Issued = { last4: string; number: string; nickname: string }

export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [issued, setIssued] = React.useState<Issued | null>(null)
  const [copied, setCopied] = React.useState(false)
  // A card settles against its merchant, so the currency follows the merchant
  // rather than being a free choice. The server enforces the same rule.
  const [merchantId, setMerchantId] = React.useState("")
  const selectedMerchant = merchants.find((m) => m.id === merchantId)
  // One key per opened form. Cleared with the rest of the state on close, so
  // the next card gets its own.
  const [issueKey, setIssueKey] = React.useState(() => crypto.randomUUID())

  function close() {
    setOpen(false)
    // The full number lives only in this component's state, and only until the
    // success screen closes. There is nowhere to read it back from.
    setIssued(null)
    setError(null)
    setCopied(false)
    setMerchantId("")
    setIssueKey(crypto.randomUUID())
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)

    const form = new FormData(event.currentTarget)
    const rawLimit = String(form.get("spendLimit") ?? "")
    const spendLimit = parseAmountToMinorUnits(rawLimit)

    // Checked here rather than with `required`: Radix Select puts the native
    // control in a visually-hidden, unfocusable select, and browsers refuse to
    // report a validation message on one.
    if (!form.get("merchantId")) {
      setError("Select a merchant.")
      setSubmitting(false)
      return
    }

    if (spendLimit === null) {
      setError("Enter a spend limit like 250 or 250.00.")
      setSubmitting(false)
      return
    }

    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // Minted once per opened form, so a retry or a second tab replays
          // onto the same card instead of issuing another.
          "idempotency-key": issueKey,
        },
        body: JSON.stringify({
          nickname: String(form.get("nickname") ?? ""),
          merchantId: String(form.get("merchantId") ?? ""),
          spendLimit,
          currency: String(form.get("currency") ?? ""),
          category: String(form.get("category") ?? "any"),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        // The server's message is the one the user sees — client checks are a
        // convenience, the server is the enforcement.
        setError(data?.error ?? "Could not issue the card. Try again.")
        return
      }

      setIssued({
        last4: data.card.last4,
        number: data.number,
        nickname: data.card.nickname,
      })
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and retry.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DrawerTrigger asChild>
        <Button className="gap-2 py-1.5">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now —
                it is not stored and cannot be retrieved later.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                <p className="text-sm text-gray-500">{issued.nickname}</p>
                <p className="mt-2 font-mono text-xl font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(.{4})/g, "$1 ").trim()}
                </p>
                <Button
                  variant="secondary"
                  className="mt-4 gap-2 py-1.5"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(issued.number)
                      setCopied(true)
                    } catch {
                      setError("Copy failed — select the number and copy it.")
                    }
                  }}
                >
                  {copied ? (
                    <Check className="size-4 shrink-0" aria-hidden="true" />
                  ) : (
                    <Copy className="size-4 shrink-0" aria-hidden="true" />
                  )}
                  {copied ? "Copied" : "Copy number"}
                </Button>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Everywhere else this card appears as{" "}
                <span className="font-medium text-gray-900 dark:text-gray-50">
                  {maskCardNumber(issued.last4)}
                </span>
                .
              </p>
              {error && (
                <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-500">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={close}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={onSubmit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  required
                  maxLength={60}
                  placeholder="Meta Ads — Q4"
                  className="mt-2"
                />
              </div>

              <div>
                <label
                  htmlFor="merchantId"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  name="merchantId"
                  value={merchantId}
                  onValueChange={setMerchantId}
                >
                  <SelectTrigger id="merchantId" className="mt-2 w-full">
                    <SelectValue placeholder="Select a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                        <span className="ml-2 text-gray-500">
                          {merchant.currency}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="spendLimit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="spendLimit"
                    name="spendLimit"
                    required
                    inputMode="decimal"
                    placeholder="2500.00"
                    className="mt-2"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Up to 50,000.00 per card.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Input
                    id="currency"
                    name="currency"
                    readOnly
                    value={selectedMerchant?.currency ?? ""}
                    placeholder="Pick a merchant"
                    aria-describedby="currency-hint"
                    className="mt-2"
                  />
                  <p id="currency-hint" className="mt-1 text-xs text-gray-500">
                    {selectedMerchant
                      ? `${selectedMerchant.name} settles in ${selectedMerchant.currency}.`
                      : "Set by the merchant you choose."}
                  </p>
                </div>
              </div>

              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select name="category" defaultValue="any">
                  <SelectTrigger id="category" className="mt-2 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CATEGORY_OPTIONS.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={close}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} disabled={submitting}>
                {submitting ? "Issuing" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
