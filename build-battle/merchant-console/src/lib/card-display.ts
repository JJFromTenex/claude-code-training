import type { Currency, MerchantCategory } from "@/data/types"

/**
 * Client-safe card display helpers and the option lists the UI renders.
 *
 * Deliberately separate from `./cards`, which holds the number generator:
 * importing that module from a `"use client"` component would ship the
 * generator into the browser bundle, and `.claude/rules/cards.md` requires
 * generation to stay on the server.
 *
 * These lists are the single source of truth. `src/data/cards.ts` derives its
 * server-side allowlists from them so the validator and the form can never
 * disagree about what a valid category or currency is.
 */

/** The only card-number rendering in the app. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

export const CARD_CURRENCY_OPTIONS: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CARD_CATEGORY_OPTIONS: readonly {
  value: MerchantCategory
  label: string
}[] = [
  { value: "any", label: "No lock" },
  { value: "advertising", label: "Advertising" },
  { value: "software", label: "Software & subscriptions" },
  { value: "contractors", label: "Contractors" },
  { value: "travel", label: "Travel" },
]

export function categoryLabel(value: MerchantCategory): string {
  return (
    CARD_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ??
    value
  )
}
