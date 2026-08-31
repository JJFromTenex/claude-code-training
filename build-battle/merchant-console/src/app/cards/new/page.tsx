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
import { merchants } from "@/data/merchants"
import { parseAmountToMinorUnits } from "@/lib/money"
import Link from "next/link"
import { useState } from "react"

const CURRENCIES = ["USD", "EUR", "GBP"] as const

// Mirrors CARD_CATEGORIES in @/data/cards — kept local (not imported) so this
// client component never pulls in server-only code (node:crypto, the store).
const CATEGORIES = [
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software & SaaS" },
  { value: "travel", label: "Travel" },
  { value: "contractors", label: "Contractors" },
  { value: "office_supplies", label: "Office supplies" },
  { value: "other", label: "Other" },
] as const

interface IssuedCard {
  id: string
  nickname: string
  fullNumber: string
}

export default function IssueCardPage() {
  const [nickname, setNickname] = useState("")
  const [merchantId, setMerchantId] = useState("")
  const [limitInput, setLimitInput] = useState("")
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("USD")
  const [category, setCategory] = useState<
    (typeof CATEGORIES)[number]["value"] | ""
  >("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [issued, setIssued] = useState<IssuedCard | null>(null)
  const [copied, setCopied] = useState(false)

  if (issued) {
    return (
      <div className="mx-auto max-w-lg p-4 sm:p-6">
        <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
          Card issued
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          This is the only time the full number is shown. Copy it now — after
          you leave this screen, it&apos;s masked everywhere.
        </p>

        <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
          <p className="text-sm text-gray-500">{issued.nickname}</p>
          <p className="mt-1 font-mono text-2xl tabular-nums text-gray-900 dark:text-gray-50">
            {issued.fullNumber}
          </p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(issued.fullNumber)
              setCopied(true)
            }}
          >
            {copied ? "Copied" : "Copy number"}
          </Button>
          <Button asChild>
            <Link href={`/cards/${issued.id}`}>View card</Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/cards">Back to cards</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg p-4 sm:p-6">
      <Link
        href="/cards"
        className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-50"
      >
        ← All cards
      </Link>

      <h1 className="mt-4 text-lg font-semibold text-gray-900 sm:text-xl dark:text-gray-50">
        Issue a card
      </h1>

      <form
        className="mt-6 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setError(null)

          const limit = parseAmountToMinorUnits(limitInput)
          if (limit === null) {
            setError("Enter the spend limit as a dollar amount, e.g. 250.00")
            return
          }

          setSubmitting(true)
          try {
            const response = await fetch("/api/cards", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                nickname,
                merchantId,
                limit,
                currency,
                category: category || null,
              }),
            })
            const body = await response.json()

            if (!response.ok) {
              setError(body.message ?? "Something went wrong")
              return
            }

            setIssued({
              id: body.card.id,
              nickname: body.card.nickname,
              fullNumber: body.fullNumber,
            })
          } catch {
            setError("Could not reach the server. Try again.")
          } finally {
            setSubmitting(false)
          }
        }}
      >
        <div>
          <label
            htmlFor="nickname"
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Nickname
          </label>
          <Input
            id="nickname"
            className="mt-1"
            placeholder="e.g. Ad spend"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            required
          />
        </div>

        <div>
          <label
            htmlFor="merchant"
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Merchant
          </label>
          <Select value={merchantId} onValueChange={setMerchantId}>
            <SelectTrigger id="merchant" className="mt-1">
              <SelectValue placeholder="Select a merchant" />
            </SelectTrigger>
            <SelectContent>
              {merchants.map((merchant) => (
                <SelectItem key={merchant.id} value={merchant.id}>
                  {merchant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label
              htmlFor="limit"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Spend limit
            </label>
            <Input
              id="limit"
              className="mt-1"
              inputMode="decimal"
              placeholder="250.00"
              value={limitInput}
              onChange={(event) => setLimitInput(event.target.value)}
              required
            />
          </div>

          <div className="w-32">
            <label
              htmlFor="currency"
              className="text-sm font-medium text-gray-900 dark:text-gray-50"
            >
              Currency
            </label>
            <Select
              value={currency}
              onValueChange={(value) =>
                setCurrency(value as (typeof CURRENCIES)[number])
              }
            >
              <SelectTrigger id="currency" className="mt-1">
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
          </div>
        </div>

        <div>
          <label
            htmlFor="category"
            className="text-sm font-medium text-gray-900 dark:text-gray-50"
          >
            Category <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <Select
            value={category}
            onValueChange={(value) =>
              setCategory(value as (typeof CATEGORIES)[number]["value"])
            }
          >
            <SelectTrigger id="category" className="mt-1">
              <SelectValue placeholder="No category lock" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
        )}

        <Button type="submit" isLoading={submitting} className="w-full">
          Issue card
        </Button>
      </form>
    </div>
  )
}
