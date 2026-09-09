import { CardStatus } from "@/data/types"

/**
 * Card number generation and the card status machine.
 *
 * Pure functions with no store access, so the rules that matter most can be
 * asserted directly. Every generated number starts with the 4242 test BIN:
 * nothing in this repository may resemble a real PAN.
 */

export const TEST_BIN = "4242"
const LENGTH = 16

/**
 * The Luhn check digit for a number that is still missing its last digit.
 * Doubling starts at the rightmost digit of the partial, because the check
 * digit that will sit to its right is the one in the undoubled position.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    const digit = partial.charCodeAt(i) - 48
    const value = double ? digit * 2 : digit
    sum += value > 9 ? value - 9 : value
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

/** Whether a complete number carries the check digit Luhn says it should. */
export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d{2,}$/.test(cardNumber)) return false
  const body = cardNumber.slice(0, -1)
  const check = cardNumber.charCodeAt(cardNumber.length - 1) - 48
  return luhnCheckDigit(body) === check
}

/**
 * A fresh sixteen-digit test-BIN number with a computed check digit.
 * Server side only — a card number produced in the browser is a bug.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = TEST_BIN
  while (body.length < LENGTH - 1) {
    body += String(Math.floor(random() * 10))
  }
  return body + String(luhnCheckDigit(body))
}

/** The only representation of a number outside the one creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  // Terminal. Nothing comes back from cancelled.
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** The actions a client may name, and the status each one asks for. */
export const CARD_ACTIONS = {
  freeze: "frozen",
  unfreeze: "active",
  cancel: "cancelled",
} as const

export type CardAction = keyof typeof CARD_ACTIONS

/**
 * Whole-percent spend against a limit. Both arguments are integer minor
 * units; the result is a display figure and never re-enters arithmetic.
 */
export function spendPercent(spent: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((spent * 100) / limit))
}

/** Past this, the bar goes amber. */
export const SPEND_WARNING_PERCENT = 80

/**
 * Tailwind compiles the classes it can see in the source, so the bar's fill
 * snaps to one of these rather than interpolating a width at runtime. The
 * percentage printed beside the bar is exact.
 */
const BAR_WIDTHS = [
  "w-[0%]",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-[100%]",
] as const

export function barWidthClass(percent: number): string {
  const step = Math.round(Math.min(100, Math.max(0, percent)) / 5)
  return BAR_WIDTHS[step]
}
