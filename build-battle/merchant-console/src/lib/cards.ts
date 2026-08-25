import { CardStatus, MerchantCategory } from "@/data/types"

/**
 * Card numbers. Test BIN only, generated server-side, never persisted in
 * full — see .claude/rules/cards.md. `generateCardNumber` is the only
 * place a number is ever produced; everything downstream sees last four.
 */

const BIN = "4242"
const NUMBER_LENGTH = 16

/** Luhn checksum, digit by digit, rightmost first. The check digit itself is never doubled. */
function luhnSum(digits: string): number {
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i])
    if (i % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum
}

/** True if the last digit of `number` is a valid Luhn check digit for the rest. */
export function isValidLuhn(number: string): boolean {
  return /^\d+$/.test(number) && luhnSum(number) % 10 === 0
}

function luhnCheckDigit(payload: string): string {
  const sum = luhnSum(payload + "0")
  return String((10 - (sum % 10)) % 10)
}

/**
 * Generates a card number on the 4242 test BIN with a valid Luhn check
 * digit. `random` is injectable so tests can seed it; production calls use
 * the default and never see the raw digits again after this call returns.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let payload = BIN
  while (payload.length < NUMBER_LENGTH - 1) {
    payload += String(Math.floor(random() * 10))
  }
  return payload + luhnCheckDigit(payload)
}

export function last4FromNumber(number: string): string {
  return number.slice(-4)
}

/** Display form everywhere but the one-time creation response. */
export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * Status is a state machine: active ⇄ frozen, either to cancelled,
 * cancelled is terminal. Guarded here so both the API route and any
 * future caller share one definition of what transition is legal.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

export const MERCHANT_CATEGORIES: readonly MerchantCategory[] = [
  "software",
  "advertising",
  "travel",
  "office_supplies",
  "shipping",
  "other",
]

export const MERCHANT_CATEGORY_LABELS: Record<MerchantCategory, string> = {
  software: "Software",
  advertising: "Advertising",
  travel: "Travel",
  office_supplies: "Office supplies",
  shipping: "Shipping",
  other: "Other",
}
