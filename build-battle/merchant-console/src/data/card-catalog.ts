import { Currency, MerchantCategory } from "./types"

/**
 * The fixed vocabulary of a card: the currencies it can settle in, the
 * categories it can be locked to, and the ceiling on its limit.
 *
 * Deliberately free of any store import. The issue form is a client component
 * and needs these lists, so anything that reaches the browser lives here
 * rather than in `cards.ts`, which touches the in-memory store and must stay
 * on the server.
 */

/** The only currencies this console issues in. */
export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

/** Integer minor units. A limit above this is refused. */
export const MAX_SPEND_LIMIT = 5_000_000

export const MERCHANT_CATEGORIES: readonly MerchantCategory[] = [
  "any",
  "advertising",
  "software",
  "travel",
  "office_supplies",
  "contractors",
]

export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  any: "No category lock",
  advertising: "Advertising",
  software: "Software and SaaS",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractors",
}

/** Spend as a fraction of the limit, clamped so a bar cannot overflow. */
export function spendRatio(spent: number, spendLimit: number): number {
  if (spendLimit <= 0) return 0
  return Math.min(1, spent / spendLimit)
}
