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
import { Currency, IssuedCard } from "@/data/types"
import { maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

const CURRENCIES: Currency[] = ["USD", "EUR", "GBP"]

export function IssueCardDialog({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limit, setLimit] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [issued, setIssued] = useState<IssuedCard | null>(null)
  const [copied, setCopied] = useState(false)

  /**
   * The full number lives in this component state and nowhere else. Dropping
   * it here is what makes the reveal one-time rather than
   * one-time-until-you-reopen-the-drawer.
   */
  function closeAndReset() {
    setOpen(false)
    setIssued(null)
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCurrency("USD")
    setErrors({})
    setMessage(null)
    setCopied(false)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setErrors({})
    setMessage(null)

    const spendLimit = parseAmountToMinorUnits(limit)
    if (spendLimit === null) {
      setErrors({ spendLimit: "Enter an amount like 250 or 250.00." })
      return
    }

    setPending(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname, merchantId, spendLimit, currency }),
      })
      const body = await response.json()
      if (!response.ok) {
        setErrors(body.errors ?? {})
        setMessage(body.message ?? "That card could not be issued.")
        return
      }
      setIssued(body as IssuedCard)
      // Refresh here, where the data actually changed, so the list behind the
      // success screen is already correct. Refreshing from the close handler
      // instead re-renders mid-exit and the drawer never finishes closing.
      router.refresh()
    } catch {
      setMessage(
        "Could not reach the server. Nothing was issued, so it is safe to try again.",
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : closeAndReset())}
    >
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now:
                once you close this it is {maskCardNumber(issued.last4)}{" "}
                everywhere, including here.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-5">
              <div>
                <p className="text-sm text-gray-500">{issued.nickname}</p>
                <p className="mt-1 font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.number}
                </p>
              </div>
              <Button
                variant="secondary"
                className="w-fit"
                onClick={async () => {
                  await navigator.clipboard.writeText(issued.number)
                  setCopied(true)
                }}
              >
                {copied ? "Copied" : "Copy number"}
              </Button>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="mt-1 tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.spendLimit, issued.currency)}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Card</dt>
                  <dd className="mt-1 font-mono text-gray-900 dark:text-gray-50">
                    {issued.id}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={closeAndReset}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                One merchant, virtual only, with a limit from the moment it
                exists.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              {message && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
                >
                  {message}
                </p>
              )}

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
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Meta ads, Q4"
                  hasError={Boolean(errors.nickname)}
                  className="mt-1.5"
                />
                {errors.nickname && <FieldError>{errors.nickname}</FieldError>}
              </div>

              <div>
                <span
                  id="merchant-label"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </span>
                <Select
                  value={merchantId}
                  onValueChange={(next) => {
                    setMerchantId(next)
                    // Default to the merchant own currency, which is nearly
                    // always what ops wants, but leave it editable.
                    const picked = merchants.find((m) => m.id === next)
                    if (picked) setCurrency(picked.currency)
                  }}
                >
                  <SelectTrigger
                    aria-labelledby="merchant-label"
                    className="mt-1.5"
                  >
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((merchant) => (
                      <SelectItem key={merchant.id} value={merchant.id}>
                        {merchant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.merchantId && (
                  <FieldError>{errors.merchantId}</FieldError>
                )}
              </div>

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
                  inputMode="decimal"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="250.00"
                  hasError={Boolean(errors.spendLimit)}
                  className="mt-1.5"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Up to {formatMoney(5_000_000, currency)}.
                </p>
                {errors.spendLimit && (
                  <FieldError>{errors.spendLimit}</FieldError>
                )}
              </div>

              <div>
                <span
                  id="currency-label"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Currency
                </span>
                <Select
                  value={currency}
                  onValueChange={(next) => setCurrency(next as Currency)}
                >
                  <SelectTrigger
                    aria-labelledby="currency-label"
                    className="mt-1.5"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.currency && <FieldError>{errors.currency}</FieldError>}
              </div>
            </DrawerBody>
            <DrawerFooter>
              <Button
                variant="secondary"
                type="button"
                onClick={closeAndReset}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={pending} loadingText="Issuing">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{children}</p>
  )
}
