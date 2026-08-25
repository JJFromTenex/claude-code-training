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
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue a card.
 *
 * The form collects strings and hands them to the server, which does the
 * validating and the generating. The revealed number lives in this component's
 * state for exactly as long as the success screen is open, and is cleared when
 * it closes — it is never written anywhere else.
 */

const CATEGORY_LABELS: Record<string, string> = {
  "": "No category lock",
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

/** Display only. Amounts travel to the server as integer minor units. */
function toMinorUnits(input: string): number | null {
  const trimmed = input.trim().replace(/[, ]/g, "")
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ""] = trimmed.split(".")
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2))
}

export function IssueCardDialog({
  merchants,
  categories,
  currencies,
}: {
  merchants: { id: string; name: string; currency: string }[]
  categories: string[]
  currencies: string[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [category, setCategory] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<{ number: string; nickname: string } | null>(null)

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setCategory("")
    setError(null)
    setBusy(false)
    setRevealed(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const spendLimit = toMinorUnits(limit)
    if (spendLimit === null) {
      setError("Enter a spend limit like 2500 or 2500.00.")
      return
    }

    setBusy(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          category: category || null,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "The card could not be issued.")
        return
      }
      setRevealed({ number: payload.number, nickname: payload.card.nickname })
      router.refresh()
    } catch {
      setError("Could not reach the server. Nothing was issued.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        // Closing discards the revealed number. There is no way back to it.
        if (!next) reset()
        setOpen(next)
      }}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-md">
        {revealed ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription className="text-sm">
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <p className="text-sm text-gray-500">{revealed.nickname}</p>
              <p
                className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-lg tracking-widest text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-50"
                aria-label="Full card number, shown once"
              >
                {revealed.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
              </p>
              <p className="text-sm text-gray-500">
                Everywhere else this card shows as •••• {revealed.number.slice(-4)}.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="py-1.5">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                Single merchant, always virtual, limit set at issue.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="nickname" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ad spend — Q3"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="merchant" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId}>
                  <SelectTrigger id="merchant" className="w-full">
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
              </div>

              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <label htmlFor="limit" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Spend limit
                  </label>
                  <Input
                    id="limit"
                    name="limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="2500.00"
                    required
                  />
                </div>
                <div className="w-32 space-y-1.5">
                  <label htmlFor="currency" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Currency
                  </label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="category" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Category lock
                </label>
                <Select value={category || "none"} onValueChange={(v) => setCategory(v === "none" ? "" : v)}>
                  <SelectTrigger id="category" className="w-full">
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category lock</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORY_LABELS[c] ?? c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                >
                  {error}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter className="gap-2">
              <DrawerClose asChild>
                <Button type="button" variant="secondary" className="py-1.5">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" className="py-1.5" disabled={busy} isLoading={busy}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
