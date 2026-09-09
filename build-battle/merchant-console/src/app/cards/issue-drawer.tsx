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
import { parseAmountToMinorUnits } from "@/lib/money"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

interface MerchantOption {
  id: string
  name: string
  currency: "USD" | "EUR" | "GBP"
}

const NO_LOCK = "none"

/**
 * Issuing a card. The number is generated on the server and shown once, here;
 * closing the drawer drops it out of client state and nothing can ask for it
 * again.
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
  const [issued, setIssued] = useState<string | null>(null)

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

    // A courtesy so a typo is not a round trip. Every one is enforced again
    // on the server, which is the enforcement.
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
      setIssued(data.fullNumber)
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
                  {issued.replace(/(.{4})/g, "$1 ").trim()}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  This is the only time it is shown.
                </p>
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
              <Field id="card-nickname" label="Nickname">
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="Q3 ad spend"
                />
              </Field>

              <Field id="card-merchant" label="Merchant">
                <Select value={merchantId} onValueChange={setMerchantId}>
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
              </Field>

              <div className="flex gap-3">
                <Field id="card-limit" label="Spend limit" className="flex-1">
                  <Input
                    id="card-limit"
                    inputMode="decimal"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    placeholder="2500.00"
                  />
                </Field>
                <Field id="card-currency" label="Currency" className="w-24">
                  <Input
                    id="card-currency"
                    readOnly
                    value={merchant?.currency ?? ""}
                    placeholder="—"
                  />
                </Field>
              </div>
              {merchant && (
                <p className="text-sm text-gray-500">
                  {merchant.name} settles in {merchant.currency}, so the card is
                  issued in {merchant.currency}.
                </p>
              )}

              <Field id="card-category" label="Category lock">
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="card-category">
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
              </Field>

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

/** Every control gets a label pointing at its own id. */
function Field({
  id,
  label,
  className,
  children,
}: {
  id: string
  label: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-gray-900 dark:text-gray-50"
      >
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
