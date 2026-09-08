"use client"

import { Button } from "@/components/Button"
import { Drawer, DrawerBody, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/Drawer"
import { Input } from "@/components/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Select"
import { Card, CardCategory, Currency } from "@/data/types"
import { CARD_CATEGORIES, MAX_SPEND_LIMIT_MINOR, maskCard } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { cx } from "@/lib/utils"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

/**
 * Issue a card, then reveal its number exactly once.
 * These checks are hints; POST /api/cards is the enforcement and its 400 shows as-is.
 * The number lives only in this state and is cleared on close; one key per opening.
 */

const NICKNAME_MAX = 40
const NO_LOCK = "none"
type Lock = CardCategory | typeof NO_LOCK
const EMPTY = { nickname: "", merchantId: "", limit: "", categoryLock: NO_LOCK as Lock }

type IssuableMerchant = { id: string; name: string; currency: Currency }

/** Ties an input to the message that describes it, so a screen reader hears both. */
const describedBy = (id: string, error: string | null) => ({
  id,
  hasError: Boolean(error),
  "aria-invalid": Boolean(error) || undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
})

function Field({ id, label, error, hint, children }: {
  id: string
  label: string
  error?: string | null
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-900 dark:text-gray-50">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-600 dark:text-red-500">{error}</p>
      ) : (
        hint && <p className="mt-1 text-sm text-gray-500">{hint}</p>
      )}
    </div>
  )
}

export function IssueCardDrawer({ merchants, triggerLabel = "Issue card" }: {
  merchants: IssuableMerchant[]
  /** The empty state passes a distinct label so the two triggers read apart. */
  triggerLabel?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [idempotencyKey, setIdempotencyKey] = useState("")
  const [form, setForm] = useState(EMPTY)
  const [touched, setTouched] = useState<{ nickname?: boolean; limit?: boolean }>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ card: Card; fullNumber: string | null } | null>(null)

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }))
  const merchant = merchants.find((m) => m.id === form.merchantId)

  const typed = form.limit.trim()
  const limitMinor = typed === "" ? null : parseAmountToMinorUnits(typed)
  const limitError =
    typed === ""
      ? "Enter a spend limit."
      : limitMinor === null
        ? "Enter the limit as a plain amount, like 250 or 250.00."
        : limitMinor === 0
          ? "The spend limit must be greater than zero."
          : merchant && limitMinor > MAX_SPEND_LIMIT_MINOR
            ? `A card cannot be issued above ${formatMoney(MAX_SPEND_LIMIT_MINOR, merchant.currency)}.`
            : null
  const nicknameError = form.nickname.trim()
    ? null
    : "Give the card a nickname so ops can recognise it later."

  // Nothing is wrong until it has been left, and a limit needs a currency to be wrong in.
  const nickShown = touched.nickname ? nicknameError : null
  const limitShown = merchant && touched.limit ? limitError : null
  const ready = !nicknameError && !limitError && Boolean(merchant)

  const handleOpenChange = (next: boolean) => {
    // One key per opening, so a double-click or a retry issues one card.
    if (next) setIdempotencyKey(crypto.randomUUID())
    else {
      // The number never outlives the success screen. The list re-reads only now:
      // a refresh while it is up unmounts the empty state's drawer, number and all.
      if (issued) router.refresh()
      setIssued(null)
      setIdempotencyKey("")
      setForm(EMPTY)
      setTouched({})
      setError(null)
    }
    setOpen(next)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!ready || submitting || !merchant || limitMinor === null) return
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: form.nickname.trim(),
          merchantId: merchant.id,
          spendLimit: limitMinor,
          currency: merchant.currency,
          categoryLock: form.categoryLock === NO_LOCK ? null : form.categoryLock,
          idempotencyKey,
        }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(payload.message ?? "The card could not be issued.")
        return
      }
      // A replay answers with the record and no number: the reveal already happened.
      setIssued({ card: payload.card, fullNumber: payload.fullNumber ?? null })
    } catch {
      setError("The console could not reach the server. Nothing was issued.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerTrigger asChild>
        <Button className="w-full gap-2 py-1.5 sm:w-fit">
          <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{issued ? "Card issued" : "Issue a virtual card"}</DrawerTitle>
          <DrawerDescription className="text-sm">
            {issued
              ? "Write the number down now. The console will not show it again."
              : "One merchant, one limit, in the merchant's own currency."}
          </DrawerDescription>
        </DrawerHeader>
        {issued ? (
          <>
            <DrawerBody className="space-y-5">
              <div aria-live="polite">
                {issued.fullNumber ? (
                  <>
                    <p className="text-sm text-gray-500">Card number</p>
                    <p className="mt-1 font-mono text-lg tracking-widest text-gray-900 dark:text-gray-50">
                      {issued.fullNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    This request had already issued the card, so there is no number to
                    show: it was revealed once, on the first answer.
                  </p>
                )}
              </div>
              <p className="text-sm text-amber-700 dark:text-amber-500">
                The full number is shown exactly once. After this drawer closes the
                console keeps only {maskCard(issued.card.last4)}.
              </p>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Nickname</dt>
                  <dd className="mt-1 text-gray-900 dark:text-gray-50">{issued.card.nickname}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Spend limit</dt>
                  <dd className="mt-1 tabular-nums text-gray-900 dark:text-gray-50">
                    {formatMoney(issued.card.spendLimit, issued.card.currency)}
                  </dd>
                </div>
              </dl>
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button className="w-full py-2 sm:w-fit">Done</Button>
              </DrawerClose>
            </DrawerFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <DrawerBody className="space-y-4">
              <Field id="card-nickname" label="Nickname" error={nickShown}>
                <Input
                  {...describedBy("card-nickname", nickShown)}
                  name="nickname"
                  className="mt-2"
                  maxLength={NICKNAME_MAX}
                  value={form.nickname}
                  onBlur={() => setTouched((t) => ({ ...t, nickname: true }))}
                  onChange={(e) => set({ nickname: e.target.value })}
                  placeholder="Meta Ads Q3"
                />
              </Field>
              <Field id="card-merchant" label="Merchant">
                <Select value={form.merchantId} onValueChange={(v) => set({ merchantId: v })}>
                  <SelectTrigger id="card-merchant" className="mt-2 w-full">
                    <SelectValue placeholder="Choose a merchant" />
                  </SelectTrigger>
                  <SelectContent>
                    {merchants.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field
                id="card-limit"
                label="Spend limit"
                error={limitShown}
                hint={merchant ? undefined : "Choose a merchant first — the limit is set in their currency."}
              >
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    {...describedBy("card-limit", limitShown)}
                    name="spendLimit"
                    type="text"
                    inputMode="decimal"
                    disabled={!merchant}
                    value={form.limit}
                    onBlur={() => setTouched((t) => ({ ...t, limit: true }))}
                    onChange={(e) => set({ limit: e.target.value })}
                    placeholder="2500.00"
                  />
                  <span className="shrink-0 text-sm text-gray-500">
                    {merchant ? merchant.currency : "—"}
                  </span>
                </div>
              </Field>
              <Field
                id="card-currency"
                label="Currency"
                hint={
                  merchant
                    ? `${merchant.name} settles in ${merchant.currency}, so the card is issued in ${merchant.currency}.`
                    : "A card is always issued in its merchant's own currency."
                }
              >
                <Input
                  id="card-currency"
                  name="currency"
                  readOnly
                  className="mt-2"
                  inputClassName="bg-gray-50 dark:bg-gray-900"
                  value={merchant ? merchant.currency : ""}
                  placeholder="Set by the merchant"
                />
              </Field>
              <Field id="card-category" label="Category lock">
                <Select
                  value={form.categoryLock}
                  onValueChange={(v) => set({ categoryLock: v as Lock })}
                >
                  <SelectTrigger
                    id="card-category"
                    className={cx("mt-2 w-full", form.categoryLock !== NO_LOCK && "capitalize")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_LOCK}>No lock</SelectItem>
                    {CARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category} className="capitalize">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {error && (
                <div
                  role="alert"
                  className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-500/10"
                >
                  <p className="text-sm text-red-700 dark:text-red-500">{error}</p>
                </div>
              )}
            </DrawerBody>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button type="button" variant="secondary" className="mt-2 w-full py-2 sm:mt-0 sm:w-fit">
                  Cancel
                </Button>
              </DrawerClose>
              <Button type="submit" className="w-full py-2 sm:w-fit" disabled={!ready} isLoading={submitting}>
                Issue card
              </Button>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  )
}
