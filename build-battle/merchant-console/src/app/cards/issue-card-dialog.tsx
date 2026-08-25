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
  CATEGORY_LABELS,
  MAX_SPEND_LIMIT,
  MERCHANT_CATEGORIES,
} from "@/data/card-catalog"
import { Currency, MerchantCategory } from "@/data/types"
import { formatCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

/**
 * The issue form and the one-time reveal. The number is generated on the
 * server and held here only long enough to be read off the success screen; it
 * is dropped when the drawer closes, because the reveal is a single response
 * and not a field that can be re-read.
 */

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

type Issued = {
  merchantName: string
  number: string
  card: {
    nickname: string
    spendLimit: number
    currency: Currency
    categoryLock: MerchantCategory
  }
}

export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [nickname, setNickname] = React.useState("")
  const [merchantId, setMerchantId] = React.useState("")
  const [limit, setLimit] = React.useState("")
  const [categoryLock, setCategoryLock] = React.useState<MerchantCategory>("any")
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [issued, setIssued] = React.useState<Issued | null>(null)
  // One key per attempt, so a double click replays rather than issuing twice.
  const key = React.useRef(newKey())

  const merchant = merchants.find((m) => m.id === merchantId)
  // A card is single-merchant, so it settles in the merchant's currency.
  const currency = merchant?.currency ?? null

  /** A field stops being wrong the moment the operator starts fixing it. */
  const clear = (...fields: string[]) =>
    setErrors(({ ...rest }) => {
      fields.forEach((f) => delete rest[f])
      return rest
    })

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimit("")
    setCategoryLock("any")
    setErrors({})
    setFormError(null)
    setIssued(null)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) reset() // Closing drops the revealed number with everything else.
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setFormError(null)

    // Amounts are converted to minor units once, here at the boundary.
    const spendLimit = parseAmountToMinorUnits(limit)
    const found: Record<string, string> = {}
    if (!nickname.trim()) found.nickname = "Give the card a nickname."
    if (!merchantId) found.merchantId = "Choose the merchant this card belongs to."
    if (spendLimit === null) found.spendLimit = "Enter an amount like 250 or 250.00."
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key.current },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit,
          currency,
          categoryLock,
        }),
      })
      const body = await response.json()

      if (!response.ok) {
        type FieldError = { field: string; message: string }
        setErrors(
          Object.fromEntries(
            (body.errors ?? []).map((e: FieldError) => [e.field, e.message]),
          ),
        )
        setFormError(body.message ?? "That card could not be issued.")
        return
      }

      if (body.replayed || !body.number) {
        setFormError(
          "This card was already issued. Its number was shown once and cannot be shown again.",
        )
      } else {
        setIssued({ card: body.card, merchantName: merchant?.name ?? "", number: body.number })
        key.current = newKey()
      }
      router.refresh()
    } catch {
      setFormError("The console could not reach the server. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <Success issued={issued} onAnother={reset} onDone={() => onOpenChange(false)} />
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The number is shown once, on the next screen.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              {formError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-400">
                  {formError}
                </p>
              )}

              <Field id="card-nickname" label="Nickname" error={errors.nickname} hint="How ops will recognise this card.">
                <Input
                  id="card-nickname"
                  value={nickname}
                  onChange={(e) => { setNickname(e.target.value); clear("nickname") }}
                  placeholder="Google Ads, contractor retainer, ..."
                  hasError={Boolean(errors.nickname)}
                  aria-invalid={Boolean(errors.nickname)}
                  aria-describedby="card-nickname-message"
                />
              </Field>

              <Field
                id="card-merchant"
                label="Merchant"
                error={errors.merchantId ?? errors.currency}
                hint="Cards belong to one merchant and settle in its currency."
              >
                <Select value={merchantId} onValueChange={(v) => { setMerchantId(v); clear("merchantId", "currency") }}>
                  <SelectTrigger id="card-merchant" className="w-full" aria-invalid={Boolean(errors.merchantId)} aria-describedby="card-merchant-message">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name} ({m.currency})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field
                id="card-limit"
                label={`Spend limit${currency ? ` (${currency})` : ""}`}
                error={errors.spendLimit}
                hint={currency ? `Up to ${formatMoney(MAX_SPEND_LIMIT, currency)} per card.` : "Choose a merchant to set the currency."}
              >
                <Input
                  id="card-limit"
                  inputMode="decimal"
                  value={limit}
                  onChange={(e) => { setLimit(e.target.value); clear("spendLimit") }}
                  placeholder="2500.00"
                  hasError={Boolean(errors.spendLimit)}
                  aria-invalid={Boolean(errors.spendLimit)}
                  aria-describedby="card-limit-message"
                />
              </Field>

              <Field id="card-category" label="Category lock" error={errors.categoryLock} hint="Recorded on the card and shown to whoever reviews it.">
                <Select value={categoryLock} onValueChange={(v) => setCategoryLock(v as MerchantCategory)}>
                  <SelectTrigger id="card-category" className="w-full" aria-describedby="card-category-message">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MERCHANT_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </DrawerBody>

            <DrawerFooter className="gap-2">
              <Button type="button" variant="secondary" className="w-full sm:w-fit" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="w-full sm:w-fit" isLoading={submitting} loadingText="Issuing">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function Success({
  issued,
  onAnother,
  onDone,
}: {
  issued: Issued
  onAnother: () => void
  onDone: () => void
}) {
  const { card, number, merchantName } = issued
  return (
    <div className="flex flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>{card.nickname} is live</DrawerTitle>
        <DrawerDescription>
          The only time the full number is shown. Copy it now; the console keeps
          the last four and nothing else.
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody className="space-y-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <p id="issued-number-label" className="text-sm text-gray-500">Card number</p>
          <p aria-labelledby="issued-number-label" className="mt-1 font-mono text-xl tracking-wider text-gray-900 dark:text-gray-50">
            {formatCardNumber(number)}
          </p>
        </div>

        <p role="status" className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-500">
          Closing this drawer discards the number for good.
        </p>

        <dl className="text-sm">
          <div className="flex justify-between border-b border-gray-200 py-2 dark:border-gray-800">
            <dt className="text-gray-500">Merchant</dt>
            <dd className="text-gray-900 dark:text-gray-50">{merchantName}</dd>
          </div>
          <div className="flex justify-between border-b border-gray-200 py-2 dark:border-gray-800">
            <dt className="text-gray-500">Spend limit</dt>
            <dd className="tabular-nums text-gray-900 dark:text-gray-50">
              {formatMoney(card.spendLimit, card.currency)} {card.currency}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-gray-500">Category lock</dt>
            <dd className="text-gray-900 dark:text-gray-50">{CATEGORY_LABELS[card.categoryLock]}</dd>
          </div>
        </dl>
      </DrawerBody>

      <DrawerFooter className="gap-2">
        <Button type="button" variant="secondary" className="w-full sm:w-fit" onClick={onAnother}>
          Issue another
        </Button>
        <Button type="button" className="w-full sm:w-fit" onClick={onDone}>Done</Button>
      </DrawerFooter>
    </div>
  )
}

/** A labelled control with one message slot, showing its error or its hint. */
function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string
  label: string
  error?: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-gray-900 dark:text-gray-50">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      <p
        id={`${id}-message`}
        className={error ? "mt-1.5 text-sm text-red-600 dark:text-red-500" : "mt-1.5 text-sm text-gray-500"}
      >
        {error ?? hint}
      </p>
    </div>
  )
}

function newKey(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `issue_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
