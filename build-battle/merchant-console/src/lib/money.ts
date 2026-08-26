import { Currency } from "@/data/types"

/**
 * Money is integer minor units everywhere in this codebase.
 * $250.00 is 25000. Format at the edge; never store what a formatter returns.
 */

const SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
}

/** Every currency this app knows about. Derived from SYMBOLS so it can't drift. */
export const CURRENCIES = Object.keys(SYMBOLS) as Currency[]

/** Render minor units for display. The only place a decimal point appears. */
export function formatMoney(minorUnits: number, currency: Currency): string {
  const negative = minorUnits < 0
  const units = Math.abs(minorUnits) / 100
  const body = units.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${negative ? "-" : ""}${SYMBOLS[currency]}${body}`
}

/** Compact form for stat cards: $12.4k. Display only. */
export function formatMoneyCompact(
  minorUnits: number,
  currency: Currency,
): string {
  const units = Math.abs(minorUnits) / 100
  if (units < 1000) return formatMoney(minorUnits, currency)
  const sign = minorUnits < 0 ? "-" : ""
  const thousands = units / 1000
  return `${sign}${SYMBOLS[currency]}${thousands.toFixed(1)}k`
}

/**
 * Sum amounts that are already known to share a currency.
 * Mixing currencies here produces a meaningless number, so callers group first.
 */
export function sumMinorUnits(amounts: number[]): number {
  return amounts.reduce((total, amount) => total + amount, 0)
}

/** Parse user input like "250" or "250.00" into minor units. Boundary only. */
export function parseAmountToMinorUnits(input: string): number | null {
  const trimmed = input.trim().replace(/[, ]/g, "")
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ""] = trimmed.split(".")
  const cents = (fraction + "00").slice(0, 2)
  return Number(whole) * 100 + Number(cents)
}
