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
import { Card } from "@/data/types"
import { cx } from "@/lib/utils"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState } from "react"

/**
 * The issue-card form, and the one screen in this application that shows a
 * full card number.
 *
 * Nothing here generates or validates anything on the client's authority: the
 * form posts to `POST /api/cards` and renders whatever that route says,
 * field errors included. Merchants and categories arrive as props rather than
 * imports so the server's store never reaches the browser bundle.
 */

interface MerchantOption {
  id: string
  name: string
  currency: string
}

interface CategoryOption {
  value: string
  label: string
}

type Issued = { card: Card; fullNumber: string }

const CURRENCIES = ["USD", "EUR", "GBP"] as const

export function IssueCardDrawer({
  merchants,
  categories,
}: {
  merchants: MerchantOption[]
  categories: CategoryOption[]
}) {
  const router = useRouter()
  const fieldId = useId()

  const [open, setOpen] = useState(false)
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [spendLimit, setSpendLimit] = useState("")
  const [currency, setCurrency] = useState<string>("USD")
  const [categoryLock, setCategoryLock] = useState("none")

  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [issued, setIssued] = useState<Issued | null>(null)

  /**
   * Resets everything, including the revealed number.
   *
   * The full number lives in component state for exactly as long as the
   * success screen is on top of it.
   */
  const reset = () => {
    setNickname("")
    setMerchantId("")
    setSpendLimit("")
    setCurrency("USD")
    setCategoryLock("none")
    setFormError(null)
    setFieldErrors({})
    setIssued(null)
    setSubmitting(false)
  }

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) {
      const hadIssued = issued !== null
      reset()
      // A card was created while the drawer was open, so the list is stale.
      if (hadIssued) router.refresh()
    }
  }

  /** The merchant's own currency is the right default, and still editable. */
  const handleMerchantChange = (id: string) => {
    setMerchantId(id)
    const merchant = merchants.find((m) => m.id === id)
    if (merchant) setCurrency(merchant.currency)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    setFormError(null)
    setFieldErrors({})

    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nickname,
          merchantId,
          spendLimit,
          currency,
          categoryLock: categoryLock === "none" ? null : categoryLock,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        setFormError(
          payload?.message ?? "That card could not be issued. Try again.",
        )
        setFieldErrors(payload?.fieldErrors ?? {})
        return
      }

      setIssued(payload as Issued)
    } catch {
      setFormError(
        "The console could not reach the server. Check your connection and try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          Issue card
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-lg">
        {issued ? (
          <IssuedCardReveal
            issued={issued}
            merchantName={
              merchants.find((m) => m.id === issued.card.merchantId)?.name ?? ""
            }
            onDone={() => handleOpenChange(false)}
          />
        ) : (
          <form onSubmit={submit} className="flex flex-1 flex-col">
            <DrawerHeader>
              <DrawerTitle>Issue a virtual card</DrawerTitle>
              <DrawerDescription className="text-sm">
                Single-merchant and limited from the moment it exists. The full
                number is shown once, on the next screen.
              </DrawerDescription>
            </DrawerHeader>

            <DrawerBody className="space-y-4">
              {formError && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400"
                >
                  {formError}
                </div>
              )}

              <Field
                id={`${fieldId}-nickname`}
                label="Nickname"
                hint="What ops will recognise this card by."
                error={fieldErrors.nickname}
              >
                <Input
                  id={`${fieldId}-nickname`}
                  name="nickname"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  placeholder="Ad spend — Q4"
                  hasError={Boolean(fieldErrors.nickname)}
                  autoComplete="off"
                />
              </Field>

              <Field
                id={`${fieldId}-merchant`}
                label="Merchant"
                error={fieldErrors.merchantId}
              >
                <Select value={merchantId} onValueChange={handleMerchantChange}>
                  <SelectTrigger
                    id={`${fieldId}-merchant`}
                    hasError={Boolean(fieldErrors.merchantId)}
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
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <Field
                    id={`${fieldId}-limit`}
                    label="Spend limit"
                    hint="Up to 50,000.00 per card."
                    error={fieldErrors.spendLimit}
                  >
                    <Input
                      id={`${fieldId}-limit`}
                      name="spendLimit"
                      value={spendLimit}
                      onChange={(event) => setSpendLimit(event.target.value)}
                      placeholder="250.00"
                      inputMode="decimal"
                      hasError={Boolean(fieldErrors.spendLimit)}
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <Field
                  id={`${fieldId}-currency`}
                  label="Currency"
                  error={fieldErrors.currency}
                >
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger
                      id={`${fieldId}-currency`}
                      hasError={Boolean(fieldErrors.currency)}
                    >
                      <SelectValue placeholder="Currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field
                id={`${fieldId}-category`}
                label="Category lock"
                hint="Optional. Records what the card is meant to be spent on."
                error={fieldErrors.categoryLock}
              >
                <Select value={categoryLock} onValueChange={setCategoryLock}>
                  <SelectTrigger
                    id={`${fieldId}-category`}
                    hasError={Boolean(fieldErrors.categoryLock)}
                  >
                    <SelectValue placeholder="No category lock" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No category lock</SelectItem>
                    {categories.map((category) => (
                      <SelectItem key={category.value} value={category.value}>
                        {category.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </DrawerBody>

            <DrawerFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={submitting} loadingText="Issuing...">
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}

/**
 * The one-time reveal.
 *
 * After this screen closes the number is gone from the browser and there is
 * no route that will return it again, so the warning is the literal truth.
 */
function IssuedCardReveal({
  issued,
  merchantName,
  onDone,
}: {
  issued: Issued
  merchantName: string
  onDone: () => void
}) {
  const [copied, setCopied] = useState(false)
  const grouped = issued.fullNumber.replace(/(\d{4})(?=\d)/g, "$1 ")

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.fullNumber)
      setCopied(true)
    } catch {
      // Clipboard access can be refused; the number is on screen regardless.
      setCopied(false)
    }
  }

  return (
    <>
      <DrawerHeader>
        <DrawerTitle>Card issued</DrawerTitle>
        <DrawerDescription className="text-sm">
          {issued.card.nickname}
          {merchantName ? ` · ${merchantName}` : ""}
        </DrawerDescription>
      </DrawerHeader>

      <DrawerBody className="space-y-4">
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-500">
          <p className="font-medium">This is the only time the number is shown.</p>
          <p className="mt-1">
            Copy it now. Once you close this drawer the console keeps only the
            last four digits, and nothing can retrieve the rest.
          </p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Card number</p>
          <p className="mt-1 font-mono text-xl tracking-wide tabular-nums text-gray-900 dark:text-gray-50">
            {grouped}
          </p>
        </div>

        <Button type="button" variant="secondary" onClick={copy}>
          {copied ? "Copied" : "Copy number"}
        </Button>
      </DrawerBody>

      <DrawerFooter>
        <Button type="button" onClick={onDone}>
          Done
        </Button>
      </DrawerFooter>
    </>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="text-sm font-medium text-gray-900 dark:text-gray-50"
      >
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && !error && <p className="mt-1.5 text-xs text-gray-500">{hint}</p>}
      {error && (
        <p
          className={cx("mt-1.5 text-xs text-red-600 dark:text-red-500")}
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}
