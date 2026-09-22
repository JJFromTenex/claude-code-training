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
import { CreditCard, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES = ["USD", "EUR", "GBP"] as const
const CATEGORIES = [
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software" },
  { value: "travel", label: "Travel" },
  { value: "contractors", label: "Contractors" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "other", label: "Other" },
] as const

interface Merchant {
  id: string
  name: string
}

export function IssueCardDrawer({ merchants }: { merchants: Merchant[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pan, setPan] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<string>("USD")
  const [category, setCategory] = useState<string>("")

  function resetForm() {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCurrency("USD")
    setCategory("")
    setError(null)
    setPan(null)
  }

  function handleClose() {
    setOpen(false)
    if (pan) {
      router.refresh()
    }
    setTimeout(resetForm, 300)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const limitCents = Math.round(parseFloat(limitInput) * 100)
    if (!limitInput || isNaN(limitCents) || limitCents <= 0) {
      setError("Enter a valid spend limit greater than zero.")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit: limitCents,
          currency,
          ...(category ? { category } : {}),
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.message ?? "Something went wrong.")
        return
      }
      setPan(data.pan)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true) }}>
      <DrawerTrigger asChild>
        <Button className="gap-2">
          <Plus className="size-4" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {pan ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                Copy the full card number now — this is the only time it will be shown.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody>
              <div className="flex flex-col items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900">
                <CreditCard className="size-10 text-blue-500" aria-hidden="true" />
                <p className="font-mono text-2xl tracking-widest text-gray-900 dark:text-gray-50">
                  {pan.match(/.{4}/g)?.join(" ")}
                </p>
                <p className="text-sm text-gray-500">
                  After you close this panel, only the last four digits will be visible.
                </p>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex h-full flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue virtual card</DrawerTitle>
              <DrawerDescription>
                The card number is generated immediately. Limits are in the currency you choose.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div className="space-y-1">
                <label htmlFor="nickname" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Nickname
                </label>
                <Input
                  id="nickname"
                  placeholder="e.g. Google Ads"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="merchant" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={setMerchantId} required>
                  <SelectTrigger id="merchant">
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

              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <label htmlFor="limit" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Spend limit
                  </label>
                  <Input
                    id="limit"
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="250.00"
                    value={limitInput}
                    onChange={(e) => setLimitInput(e.target.value)}
                    required
                  />
                </div>
                <div className="w-28 space-y-1">
                  <label htmlFor="currency" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                    Currency
                  </label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="category" className="text-sm font-medium text-gray-900 dark:text-gray-50">
                  Category <span className="text-gray-400">(optional)</span>
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="No category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DrawerClose>
              <Button
                type="submit"
                isLoading={loading}
                loadingText="Issuing…"
                disabled={!nickname || !merchantId || !limitInput}
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
