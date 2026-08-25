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
import { CATEGORY_LABELS, MERCHANT_CATEGORIES } from "@/data/cards"
import { Currency, MerchantCategory } from "@/data/types"
import { formatCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import * as React from "react"

/**
 * The issue form and the one-time reveal.
 *
 * The card number is generated on the server and arrives in the issue
 * response. It is held in local state only long enough to be read off the
 * success screen and is dropped the moment the drawer closes, because the
 * reveal is a single response and not a field that can be re-read.
 */

interface MerchantOption {
  id: string
  name: string
  currency: Currency
}

interface FieldError {
  field: string
  message: string
}

interface IssuedSummary {
  nickname: string
  merchantName: string
  spendLimit: number
  currency: Currency
  categoryLock: MerchantCategory
  number: string
}

export function IssueCardDialog({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [nickname, setNickname] = React.useState("")
  const [merchantId, setMerchantId] = React.useState("")
  const [limitInput, setLimitInput] = React.useState("")
  const [categoryLock, setCategoryLock] = React.useState<MerchantCategory>("any")
  const [errors, setErrors] = React.useState<FieldError[]>([])
  const [formError, setFormError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [issued, setIssued] = React.useState<IssuedSummary | null>(null)
  // One key per attempt. A double click reuses it, so the server replays the
  // first card instead of issuing a second one.
  const issueKey = React.useRef(newIssueKey())

  const merchant = merchants.find((option) => option.id === merchantId)
  // A card is single-merchant, so it settles in the merchant's currency.
  const currency = merchant?.currency ?? null

  const errorFor = (field: string) =>
    errors.find((error) => error.field === field)?.message

  /** A field stops being wrong the moment the operator starts fixing it. */
  const clearError = (field: string) =>
    setErrors((current) => current.filter((error) => error.field !== field))

  const reset = () => {
    setNickname("")
    setMerchantId("")
    setLimitInput("")
    setCategoryLock("any")
    setErrors([])
    setFormError(null)
    setIssued(null)
  }

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    // Closing drops the revealed number along with everything else.
    if (!next) reset()
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    setErrors([])
    setFormError(null)

    // Amounts are converted to minor units once, here at the boundary.
    const spendLimit = parseAmountToMinorUnits(limitInput)
    const clientErrors: FieldError[] = []
    if (!nickname.trim()) {
      clientErrors.push({ field: "nickname", message: "Give the card a nickname." })
    }
    if (!merchantId) {
      clientErrors.push({
        field: "merchantId",
        message: "Choose the merchant this card belongs to.",
      })
    }
    if (spendLimit === null) {
      clientErrors.push({
        field: "spendLimit",
        message: "Enter an amount like 250 or 250.00.",
      })
    }
    if (clientErrors.length > 0) {
      setErrors(clientErrors)
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // One key per attempt, so a double click cannot issue two cards.
          "idempotency-key": issueKey.current,
        },
        body: JSON.stringify({
          nickname: nickname.trim(),
          merchantId,
          spendLimit,
          currency,
          categoryLock,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        setErrors(payload.errors ?? [])
        setFormError(payload.message ?? "That card could not be issued.")
        return
      }

      if (payload.replayed || !payload.number) {
        // The card exists already; the number was revealed on the first try.
        setFormError(
          "This card was already issued. Its number was shown once and cannot be shown again.",
        )
        router.refresh()
        return
      }

      setIssued({
        nickname: payload.card.nickname,
        merchantName: merchant?.name ?? "",
        spendLimit: payload.card.spendLimit,
        currency: payload.card.currency,
        categoryLock: payload.card.categoryLock,
        number: payload.number,
      })
      // New key, so issuing a second card is a new request.
      issueKey.current = newIssueKey()
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
          <IssuedSuccess
            issued={issued}
            onIssueAnother={reset}
            onDone={() => onOpenChange(false)}
          />
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription>
                The card is created straight away and its number is shown once,
                on the next screen.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              {formError && (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-400/10 dark:text-red-400"
                >
                  {formError}
                </p>
              )}

              <div>
                <label
                  htmlFor="card-nickname"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Nickname
                </label>
                <Input
                  id="card-nickname"
                  name="nickname"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value)
                    clearError("nickname")
                  }}
                  placeholder="Google Ads, contractor retainer, ..."
                  hasError={Boolean(errorFor("nickname"))}
                  aria-describedby={
                    errorFor("nickname") ? "card-nickname-error" : undefined
                  }
                  className="mt-2"
                />
                <FieldMessage id="card-nickname-error" message={errorFor("nickname")}>
                  How ops will recognise this card in the list.
                </FieldMessage>
              </div>

              <div>
                <label
                  htmlFor="card-merchant"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Merchant
                </label>
                <Select
                  value={merchantId}
                  onValueChange={(value) => {
                    setMerchantId(value)
                    clearError("merchantId")
                    clearError("currency")
                  }}
                >
                  <SelectTrigger id="card-merchant" className="mt-2 w-full">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name} ({option.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldMessage
                  id="card-merchant-error"
                  message={errorFor("merchantId")}
                >
                  Cards belong to one merchant and settle in that merchant&rsquo;s
                  currency.
                </FieldMessage>
              </div>

              <div>
                <label
                  htmlFor="card-limit"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Spend limit {currency ? `(${currency})` : ""}
                </label>
                <Input
                  id="card-limit"
                  name="spendLimit"
                  inputMode="decimal"
                  value={limitInput}
                  onChange={(event) => {
                    setLimitInput(event.target.value)
                    clearError("spendLimit")
                  }}
                  placeholder="2500.00"
                  hasError={Boolean(errorFor("spendLimit"))}
                  aria-describedby="card-limit-help"
                  className="mt-2"
                />
                <FieldMessage id="card-limit-help" message={errorFor("spendLimit")}>
                  {currency
                    ? `Up to ${formatMoney(5_000_000, currency)} per card.`
                    : "Choose a merchant to set the currency."}
                </FieldMessage>
              </div>

              <div>
                <label
                  htmlFor="card-category"
                  className="text-sm font-medium text-gray-900 dark:text-gray-50"
                >
                  Category lock
                </label>
                <Select
                  value={categoryLock}
                  onValueChange={(value) =>
                    setCategoryLock(value as MerchantCategory)
                  }
                >
                  <SelectTrigger id="card-category" className="mt-2 w-full">
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    {MERCHANT_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldMessage
                  id="card-category-error"
                  message={errorFor("categoryLock")}
                >
                  Recorded on the card and shown to whoever reviews it.
                </FieldMessage>
              </div>
            </DrawerBody>

            <DrawerFooter className="gap-2">
              <Button
                type="button"
                variant="secondary"
                className="w-full sm:w-fit"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-fit"
                isLoading={submitting}
                loadingText="Issuing"
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

function IssuedSuccess({
  issued,
  onIssueAnother,
  onDone,
}: {
  issued: IssuedSummary
  onIssueAnother: () => void
  onDone: () => void
}) {
  return (
    <div className="flex flex-1 flex-col">
      <DrawerHeader>
        <DrawerTitle>{issued.nickname} is live</DrawerTitle>
        <DrawerDescription>
          This is the only time the full number is shown. Copy it now; the
          console keeps the last four and nothing else.
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody className="space-y-4">
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">Card number</p>
          <p className="mt-1 font-mono text-xl tracking-wider text-gray-900 dark:text-gray-50">
            {formatCardNumber(issued.number)}
          </p>
        </div>

        <p
          role="status"
          className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-400/10 dark:text-amber-500"
        >
          Closing this drawer discards the number for good.
        </p>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-sm text-gray-500">Merchant</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
              {issued.merchantName}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Spend limit</dt>
            <dd className="mt-1 text-sm tabular-nums text-gray-900 dark:text-gray-50">
              {formatMoney(issued.spendLimit, issued.currency)} {issued.currency}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Category lock</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-50">
              {CATEGORY_LABELS[issued.categoryLock]}
            </dd>
          </div>
        </dl>
      </DrawerBody>

      <DrawerFooter className="gap-2">
        <Button
          type="button"
          variant="secondary"
          className="w-full sm:w-fit"
          onClick={onIssueAnother}
        >
          Issue another
        </Button>
        <Button type="button" className="w-full sm:w-fit" onClick={onDone}>
          Done
        </Button>
      </DrawerFooter>
    </div>
  )
}

function FieldMessage({
  id,
  message,
  children,
}: {
  id: string
  message?: string
  children: React.ReactNode
}) {
  return (
    <p
      id={id}
      className={
        message
          ? "mt-1.5 text-sm text-red-600 dark:text-red-500"
          : "mt-1.5 text-sm text-gray-500"
      }
    >
      {message ?? children}
    </p>
  )
}

function newIssueKey(): string {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `issue_${Date.now()}_${Math.random().toString(36).slice(2)}`
}
