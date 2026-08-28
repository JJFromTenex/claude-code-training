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
import { CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, SPEND_LIMIT_MAX } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

const CATEGORY_LABELS: Record<CardCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  utilities: "Utilities",
}

const fieldStyles =
  "block w-full rounded-md border border-gray-300 bg-white px-2.5 py-2 text-sm text-gray-900 shadow-sm outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-50"

const labelStyles = "text-sm font-medium text-gray-900 dark:text-gray-50"

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

type Issued = { last4: string; number: string; nickname: string }

/**
 * The issue form.
 *
 * Currency is derived from the chosen merchant rather than picked, because a
 * card that settles in a currency its merchant does not use is a support
 * ticket the first time it runs. The server checks the pairing again.
 */
export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [merchantId, setMerchantId] = useState("")
  const [nickname, setNickname] = useState("")
  const [limit, setLimit] = useState("")
  const [category, setCategory] = useState<"" | CardCategory>("")
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [issued, setIssued] = useState<Issued | null>(null)
  // Held for the life of the form, so a retry after a timeout is the same
  // request rather than a second card.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const merchant = merchants.find((m) => m.id === merchantId)
  const minorUnits = parseAmountToMinorUnits(limit)

  const reset = () => {
    setMerchantId("")
    setNickname("")
    setLimit("")
    setCategory("")
    setErrors({})
    setFormError(null)
    setIssued(null)
    setRequestId(crypto.randomUUID())
  }

  // Clearing runs after the close settles rather than inside Radix's own
  // handler. Doing it inline fought the exit transition, so Escape landed
  // sometimes and not others.
  useEffect(() => {
    if (open) return
    reset()
    // Radix restores focus on unmount, but the reset above re-renders while it
    // is doing so and focus lands on the body. Putting it back is explicit
    // rather than a race.
    triggerRef.current?.focus()
    // reset only touches setState, which is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setErrors({})
    setFormError(null)

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": requestId,
        },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit: minorUnits,
          currency: merchant?.currency ?? "",
          categoryLock: category || null,
          requestId,
        }),
      })

      const body = await response.json()

      if (!response.ok) {
        const next: Record<string, string> = {}
        for (const error of body.errors ?? []) next[error.field] = error.message
        setErrors(next)
        setFormError(
          body.errors?.length ? null : (body.message ?? "That did not work."),
        )
        return
      }

      if (body.replayed) {
        // The card already exists from an earlier attempt. Its number was
        // revealed then and is not shown again.
        setFormError(
          "That card was already issued. Its number was shown on the first attempt.",
        )
        router.refresh()
        return
      }

      setIssued({
        last4: body.card.last4,
        number: body.number,
        nickname: body.card.nickname,
      })
      router.refresh()
    } catch {
      setFormError("The console could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button ref={triggerRef} className="w-full gap-2 py-1.5 sm:w-fit">
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
                This is the only time the full number is shown. Copy it now.
              </DrawerDescription>
            </DrawerHeader>
            <DrawerBody className="flex flex-col gap-4">
              <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
                <p className="text-sm text-gray-500">{issued.nickname}</p>
                <p className="mt-1 font-mono text-lg tracking-wider text-gray-900 tabular-nums dark:text-gray-50">
                  {issued.number}
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Everywhere else in the console this card reads{" "}
                <span className="font-mono">•••• {issued.last4}</span>.
              </p>
            </DrawerBody>
            <DrawerFooter>
              <Button onClick={() => setOpen(false)}>Done</Button>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                Single merchant, with a spend limit from the moment it exists.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="nickname" className={labelStyles}>
                  Nickname
                </label>
                <Input
                  id="nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend, Q3"
                  aria-describedby={errors.nickname ? "nickname-error" : undefined}
                  aria-invalid={Boolean(errors.nickname)}
                />
                {errors.nickname && (
                  <p id="nickname-error" className="text-sm text-red-600 dark:text-red-500">
                    {errors.nickname}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="merchantId" className={labelStyles}>
                  Merchant
                </label>
                <select
                  id="merchantId"
                  name="merchantId"
                  value={merchantId}
                  onChange={(event) => setMerchantId(event.target.value)}
                  className={fieldStyles}
                  aria-describedby="merchant-hint"
                  aria-invalid={Boolean(errors.merchantId)}
                >
                  <option value="">Choose a merchant</option>
                  {merchants.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <p id="merchant-hint" className="text-sm text-gray-500">
                  {merchant
                    ? `Settles in ${merchant.currency}, so the card is issued in ${merchant.currency}.`
                    : "The card takes its currency from the merchant."}
                </p>
                {errors.merchantId && (
                  <p className="text-sm text-red-600 dark:text-red-500">
                    {errors.merchantId}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="limit" className={labelStyles}>
                  Spend limit{merchant ? ` (${merchant.currency})` : ""}
                </label>
                <Input
                  id="limit"
                  name="limit"
                  inputMode="decimal"
                  value={limit}
                  onChange={(event) => setLimit(event.target.value)}
                  placeholder="2500.00"
                  aria-describedby="limit-hint"
                  aria-invalid={Boolean(errors.spendLimit)}
                />
                <p id="limit-hint" className="text-sm text-gray-500">
                  {minorUnits !== null && merchant
                    ? `${formatMoney(minorUnits, merchant.currency)}, stored as ${minorUnits} minor units.`
                    : `Up to ${SPEND_LIMIT_MAX.toLocaleString()} minor units.`}
                </p>
                {errors.spendLimit && (
                  <p className="text-sm text-red-600 dark:text-red-500">
                    {errors.spendLimit}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="category" className={labelStyles}>
                  Category lock (optional)
                </label>
                <select
                  id="category"
                  name="category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as "" | CardCategory)
                  }
                  className={fieldStyles}
                >
                  <option value="">No lock</option>
                  {CARD_CATEGORIES.map((option) => (
                    <option key={option} value={option}>
                      {CATEGORY_LABELS[option]}
                    </option>
                  ))}
                </select>
                {errors.categoryLock && (
                  <p className="text-sm text-red-600 dark:text-red-500">
                    {errors.categoryLock}
                  </p>
                )}
              </div>

              {errors.currency && (
                <p className="text-sm text-red-600 dark:text-red-500">
                  {errors.currency}
                </p>
              )}
              {formError && (
                <p role="alert" className="text-sm text-red-600 dark:text-red-500">
                  {formError}
                </p>
              )}
            </DrawerBody>

            <DrawerFooter>
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
