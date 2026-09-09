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
import { CARD_CATEGORIES } from "@/data/types"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

interface MerchantOption {
  id: string
  name: string
  currency: "USD" | "EUR" | "GBP"
}

const NO_LOCK = "none"

/**
 * Issuing a card. The number is generated on the server and shown here once,
 * on the success screen; closing the drawer drops it out of client state and
 * there is no way to ask for it again.
 */
export function IssueCardDrawer({
  merchants,
  label = "Issue a card",
}: {
  merchants: MerchantOption[]
  label?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState<string>(NO_LOCK)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [issued, setIssued] = useState<{
    number: string
    nickname: string
    limit: number
    currency: MerchantOption["currency"]
  } | null>(null)

  // One key per opening of the drawer, so a double submit replays the first
  // card instead of minting a second. The server is what honours it.
  const keyRef = useRef<string | null>(null)

  const merchant = merchants.find((m) => m.id === merchantId) ?? null

  const close = () => {
    setOpen(false)
    // The reveal is over the moment this closes.
    setIssued(null)
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCategory(NO_LOCK)
    setError(null)
    keyRef.current = null
    router.refresh()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    // Client-side checks are a courtesy so the operator is not round-tripped
    // for a typo. Every one of them is enforced again on the server.
    if (!nickname.trim())
      return setError("Give the card a nickname so ops can recognise it later.")
    if (!merchant) return setError("Choose the merchant this card belongs to.")
    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null)
      return setError("Enter a limit like 250 or 250.00.")

    keyRef.current ??= crypto.randomUUID()
    setBusy(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": keyRef.current,
        },
        body: JSON.stringify({
          nickname,
          merchantId: merchant.id,
          spendLimit,
          currency: merchant.currency,
          categoryLock: category === NO_LOCK ? null : category,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setError(data?.message ?? "The card could not be issued.")
        return
      }
      setIssued({
        number: data.fullNumber,
        nickname: data.card.nickname,
        limit: data.card.spendLimit,
        currency: data.card.currency,
      })
    } catch {
      setError("The console could not reach the server. Nothing was issued.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : close())}
    >
      <DrawerTrigger asChild>
        <Button className="w-full py-1.5 sm:w-fit">{label}</Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>
            {issued ? "Card issued" : "Issue a virtual card"}
          </DrawerTitle>
          <DrawerDescription>
            {issued
              ? "Copy the number now. The console keeps the last four and nothing else."
              : "One merchant, one spend limit, live immediately."}
          </DrawerDescription>
        </DrawerHeader>

        {issued ? (
          <>
            <DrawerBody>
              <div aria-live="polite">
                <p className="text-sm text-gray-500">Card number</p>
                <p className="mt-1 font-mono text-lg tracking-widest text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(.{4})/g, "$1 ").trim()}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  This is the only time it is shown.
                </p>
                <dl className="mt-6 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Nickname</dt>
                    <dd className="text-gray-900 dark:text-gray-50">
                      {issued.nickname}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Spend limit</dt>
                    <dd className="tabular-nums text-gray-900 dark:text-gray-50">
                      {formatMoney(issued.limit, issued.currency)}
                    </dd>
                  </div>
                </dl>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button className="w-full" onClick={close}>
                Done
              </Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DrawerBody className="space-y-4">
              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  className="mt-1"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Q3 ad spend"
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
                  <SelectTrigger id="card-merchant" className="mt-1">
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
                <div className="flex-1">
                  <label
                    htmlFor="card-limit"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Spend limit
                  </label>
                  <Input
                    id="card-limit"
                    className="mt-1"
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="2500.00"
                  />
                </div>
                <div className="w-24">
                  <label
                    htmlFor="card-currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Input
                    id="card-currency"
                    className="mt-1"
                    readOnly
                    value={merchant?.currency ?? ""}
                    placeholder="—"
                  />
                </div>
              </div>
              {merchant && (
                <p className="text-sm text-gray-500">
                  {merchant.name} settles in {merchant.currency}, so the card is
                  issued in {merchant.currency}.
                </p>
              )}

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="card-category" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LOCK}>No lock</SelectItem>
                    {CARD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c} className="capitalize">
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <p
                  role="alert"
                  className="text-sm text-red-600 dark:text-red-500"
                >
                  {error}
                </p>
              )}
            </DrawerBody>
            <DrawerFooter>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Issuing…" : "Issue card"}
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
