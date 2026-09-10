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
import { Card, Currency } from "@/data/types"
import { CURRENCIES, MAX_NICKNAME_LENGTH } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

type Field = "nickname" | "merchantId" | "spendLimit" | "currency"
type Errors = Partial<Record<Field | "form", string>>

/**
 * Issue a card and reveal its number exactly once.
 *
 * The full number lives only in this component's state, only while the
 * success screen is open. Closing the drawer resets every piece of state, so
 * nothing survives into the next open, a refresh, or the URL.
 */
export function IssueCardDrawer({
  merchants,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [currency, setCurrency] = useState<Currency>("USD")
  const [limitInput, setLimitInput] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<{ card: Card; number: string } | null>(null)
  // One key per open form. A retry of the same submission reuses it, so the
  // server returns the card it already issued instead of minting another.
  const [issueKey, setIssueKey] = useState("")

  const selectedMerchant = merchants.find((m) => m.id === merchantId)
  const currencyMismatch =
    selectedMerchant !== undefined && selectedMerchant.currency !== currency

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setCurrency("USD")
    setLimitInput("")
    setErrors({})
    setSubmitting(false)
    setIssued(null)
    setIssueKey("")
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) setIssueKey(crypto.randomUUID())
    else reset()
  }

  const chooseMerchant = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const next: Errors = {}
    if (!nickname.trim()) next.nickname = "Give the card a nickname."
    if (!merchantId) next.merchantId = "Choose a merchant."
    const spendLimit = parseAmountToMinorUnits(limitInput)
    if (spendLimit === null) {
      next.spendLimit = "Enter an amount like 250 or 250.00."
    } else if (spendLimit <= 0) {
      next.spendLimit = "The limit must be more than zero."
    }
    if (Object.keys(next).length > 0) {
      setErrors(next)
      return
    }

    setErrors({})
    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": issueKey,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit,
          currency,
        }),
      })
      const data = await response.json().catch(() => null)
      if (!response.ok) {
        const field = (data?.field as Field | undefined) ?? "form"
        setErrors({ [field]: data?.message ?? "The card could not be issued." })
        return
      }
      setIssued({ card: data.card, number: data.number })
      router.refresh()
    } catch {
      setErrors({ form: "Could not reach the server. Check the connection and try again." })
    } finally {
      setSubmitting(false)
    }
  }

  const describedBy = (field: Field, hint?: string) =>
    [errors[field] ? `${field}-error` : null, hint ? `${field}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>
      <DrawerContent aria-describedby={undefined}>
        {issued ? (
          <>
            <DrawerHeader>
              <DrawerTitle>Card issued</DrawerTitle>
              <DrawerDescription>
                This is the only time the full number is shown. Copy it now; the
                console keeps the last four only.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  Card number
                </p>
                <p className="mt-1 font-mono text-xl tabular-nums text-gray-900 dark:text-gray-50">
                  {issued.number.replace(/(\d{4})(?=\d)/g, "$1 ")}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="text-gray-900 dark:text-gray-50">{issued.card.nickname}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Merchant</dt>
                  <dd className="text-gray-900 dark:text-gray-50">
                    {merchants.find((m) => m.id === issued.card.merchantId)?.name ??
                      issued.card.merchantId}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.spendLimit, issued.card.currency)}{" "}
                    {issued.card.currency}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Card ID</dt>
                  <dd className="font-mono text-gray-900 dark:text-gray-50">{issued.card.id}</dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button>Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} noValidate>
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, always virtual, with a limit from the start.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="space-y-5">
              {errors.form && (
                <p
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
                >
                  {errors.form}
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
                  className="mt-2"
                  value={nickname}
                  maxLength={MAX_NICKNAME_LENGTH}
                  placeholder="Ad spend, vendor subscription…"
                  hasError={Boolean(errors.nickname)}
                  aria-invalid={Boolean(errors.nickname)}
                  aria-describedby={describedBy("nickname")}
                  onChange={(event) => setNickname(event.target.value)}
                />
                {errors.nickname && (
                  <p id="nickname-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.nickname}
                  </p>
                )}
              </div>

              <div>
                <label
                  id="merchantId-label"
                  htmlFor="merchantId"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select value={merchantId} onValueChange={chooseMerchant}>
                  <SelectTrigger
                    id="merchantId"
                    className="mt-2"
                    hasError={Boolean(errors.merchantId)}
                    aria-labelledby="merchantId-label"
                    aria-invalid={Boolean(errors.merchantId)}
                    aria-describedby={describedBy("merchantId")}
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
                  <p id="merchantId-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                    {errors.merchantId}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-[1fr_7rem] gap-3">
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
                    className="mt-2"
                    inputMode="decimal"
                    value={limitInput}
                    placeholder="250.00"
                    hasError={Boolean(errors.spendLimit)}
                    aria-invalid={Boolean(errors.spendLimit)}
                    aria-describedby={describedBy("spendLimit", "hint")}
                    onChange={(event) => setLimitInput(event.target.value)}
                  />
                  {errors.spendLimit ? (
                    <p id="spendLimit-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.spendLimit}
                    </p>
                  ) : (
                    <p id="spendLimit-hint" className="mt-1 text-sm text-gray-500">
                      Up to 50,000.00. Whole units or two decimals.
                    </p>
                  )}
                </div>
                <div>
                  <label
                    id="currency-label"
                    htmlFor="currency"
                    className="text-sm font-medium text-gray-900 dark:text-gray-50"
                  >
                    Currency
                  </label>
                  <Select
                    value={currency}
                    onValueChange={(value) => setCurrency(value as Currency)}
                  >
                    <SelectTrigger
                      id="currency"
                      className="mt-2"
                      hasError={Boolean(errors.currency)}
                      aria-labelledby="currency-label"
                      aria-invalid={Boolean(errors.currency)}
                      aria-describedby={describedBy(
                        "currency",
                        currencyMismatch ? "hint" : undefined,
                      )}
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
                  {errors.currency ? (
                    <p id="currency-error" className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.currency}
                    </p>
                  ) : (
                    currencyMismatch && (
                      <p
                        id="currency-hint"
                        className="mt-1 text-sm text-amber-700 dark:text-amber-400"
                      >
                        {selectedMerchant.name} settles in {selectedMerchant.currency}.
                      </p>
                    )
                  )}
                </div>
              </div>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="secondary" type="button">
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
