"use client"

import { Button } from "@/components/Button"
import { Input } from "@/components/Input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { CATEGORY_LABELS } from "@/data/cards"
import { Card, Currency, MerchantCategory } from "@/data/types"
import { MAX_SPEND_LIMIT, formatCardNumber, maskCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useId, useRef, useState } from "react"

const NONE = "none"
const BLANK = {
  nickname: "",
  merchantId: "",
  limit: "",
  currency: "USD" as Currency,
  category: NONE as string,
}
const LABEL = "text-sm font-medium text-gray-900 dark:text-gray-50"
const HINT = "mt-1 text-sm text-gray-500"

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `key_${Date.now()}_${Math.round(Math.random() * 1e9)}`

export function IssueCard({
  merchants,
  currencies,
  categories,
}: {
  merchants: { id: string; name: string; currency: Currency }[]
  currencies: readonly Currency[]
  categories: readonly MerchantCategory[]
}) {
  const router = useRouter()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** The only copy of a full number; cleared on dismiss. */
  const [issued, setIssued] = useState<{
    card: Card
    cardNumber: string | null
  } | null>(null)
  /** One key per form, so a retry cannot make a second card. */
  const [key, setKey] = useState(newKey)

  const set = (patch: Partial<typeof BLANK>) =>
    setForm((f) => ({ ...f, ...patch }))
  const merchant = merchants.find((m) => m.id === form.merchantId)

  // components.md: focus in on open, back to the trigger on close, Escape
  // closes — else the trigger unmounts under the user's focus.
  const trigger = useRef<HTMLButtonElement>(null)
  const firstField = useRef<HTMLInputElement>(null)
  const returning = useRef(false)

  useEffect(() => {
    if (open && !issued) firstField.current?.focus()
    else if (!open && !issued && returning.current) {
      trigger.current?.focus()
      returning.current = false
    }
  }, [open, issued])

  const leave = (clearIssued = false) => {
    returning.current = true
    if (clearIssued) setIssued(null)
    setForm(BLANK)
    setError(null)
    setOpen(false)
    if (clearIssued) router.refresh()
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // A convenience so the round trip is not wasted. The server decides.
    const spendLimit = parseAmountToMinorUnits(form.limit)
    if (spendLimit === null)
      return setError("Enter a spend limit like 250 or 250.00.")

    setBusy(true)
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": key },
        body: JSON.stringify({
          ...form,
          spendLimit,
          category: form.category === NONE ? null : form.category,
        }),
      })
      const body = await res.json()

      if (!res.ok) {
        // 409: the key is spent on a different card — the earlier request
        // landed though its response did not. Retire it, or every later edit
        // gets 409 and only a reload escapes.
        if (res.status === 409) {
          setKey(newKey())
          router.refresh()
        }
        setError(
          res.status === 409
            ? "An earlier attempt already created a card. Check the list below, then submit again."
            : (body.message ?? "The card could not be issued."),
        )
        return
      }

      setIssued({ card: body.card, cardNumber: body.cardNumber })
      setKey(newKey())
      setForm(BLANK)
      router.refresh()
    } catch {
      setError("Could not reach the server. Check your connection and retry.")
    } finally {
      setBusy(false)
    }
  }

  // The one screen allowed to show a full number, just after it is issued.
  if (issued) {
    const { card, cardNumber } = issued
    return (
      <section
        aria-labelledby={`${id}-ok`}
        className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 sm:p-6 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
      >
        <h2 id={`${id}-ok`} className="font-semibold">
          {card.nickname} is issued
        </h2>
        <p className="mt-1">
          {cardNumber
            ? `This is the only time the full number is shown. Copy it now — from here on the card reads ${maskCardNumber(card.last4)}.`
            : `This request had already been sent, so no second card was created. The number was shown once when the card was issued and cannot be shown again — this card reads ${maskCardNumber(card.last4)}.`}
        </p>
        {cardNumber && (
          <p
            className="mt-4 font-mono text-xl tracking-wider text-gray-900 dark:text-gray-50"
            aria-label={`Card number ${cardNumber.split("").join(" ")}`}
          >
            {formatCardNumber(cardNumber)}
          </p>
        )}
        <p className="mt-2">
          Limit {formatMoney(card.spendLimit, card.currency)} {card.currency} ·
          reference {card.reference}
        </p>
        <Button className="mt-4 py-1.5" autoFocus onClick={() => leave(true)}>
          Done — hide the number
        </Button>
      </section>
    )
  }

  if (!open)
    return (
      <Button
        ref={trigger}
        className="w-full gap-2 py-1.5 sm:w-fit"
        onClick={() => setOpen(true)}
      >
        <Plus className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
        Issue a card
      </Button>
    )

  // Currency follows the merchant because the server requires them to match.
  const selects = [
    {
      name: "merchantId" as const,
      label: "Merchant",
      placeholder: "Choose a merchant",
      options: merchants.map((m) => ({ value: m.id, label: m.name })),
      onPick: (v: string) => ({
        merchantId: v,
        currency: merchants.find((m) => m.id === v)?.currency ?? form.currency,
      }),
    },
    {
      name: "currency" as const,
      label: "Currency",
      placeholder: "Currency",
      hint: merchant && `${merchant.name} settles in ${merchant.currency}.`,
      options: currencies.map((c) => ({ value: c, label: c })),
      onPick: (v: string) => ({ currency: v as Currency }),
    },
    {
      name: "category" as const,
      label: "Category lock",
      placeholder: "No lock",
      options: [
        { value: NONE, label: "No lock" },
        ...categories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
      ],
      onPick: (v: string) => ({ category: v }),
    },
  ]

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && leave()}
      aria-labelledby={`${id}-heading`}
      className="rounded-lg border border-gray-200 p-4 sm:p-6 dark:border-gray-800"
    >
      <h2 id={`${id}-heading`} className={LABEL}>
        Issue a virtual card
      </h2>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor={`${id}-nickname`} className={LABEL}>
            Nickname
          </label>
          <Input
            ref={firstField}
            id={`${id}-nickname`}
            className="mt-2"
            placeholder="Meta Ads"
            value={form.nickname}
            onChange={(e) => set({ nickname: e.target.value })}
          />
        </div>

        <div>
          <label htmlFor={`${id}-limit`} className={LABEL}>
            Spend limit
          </label>
          <Input
            id={`${id}-limit`}
            className="mt-2"
            inputMode="decimal"
            placeholder="250.00"
            aria-describedby={`${id}-limit-hint`}
            value={form.limit}
            onChange={(e) => set({ limit: e.target.value })}
          />
          <p id={`${id}-limit-hint`} className={HINT}>
            Up to {formatMoney(MAX_SPEND_LIMIT, form.currency)}.
          </p>
        </div>

        {selects.map(({ name, label, placeholder, options, hint, onPick }) => (
          <div key={name}>
            <label htmlFor={`${id}-${name}`} className={LABEL}>
              {label}
            </label>
            <Select value={form[name]} onValueChange={(v) => set(onPick(v))}>
              <SelectTrigger id={`${id}-${name}`} className="mt-2">
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hint && <p className={HINT}>{hint}</p>}
          </div>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-2">
        <Button type="submit" className="py-1.5" isLoading={busy}>
          Issue card
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="py-1.5"
          onClick={() => leave()}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
