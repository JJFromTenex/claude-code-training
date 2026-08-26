import { CardStatus } from "@/data/types"

/**
 * Number generation and the status machine. Server-side only; every number
 * starts with the 4242 test BIN, so nothing here can resemble a real PAN.
 */

/** The test BIN. Not optional: it is what keeps generated numbers fake. */
export const TEST_BIN = "4242"

/** Ceiling on a spend limit, in minor units. Above this is a typo, not a card. */
export const MAX_SPEND_LIMIT = 5_000_000

const CARD_NUMBER_LENGTH = 16

/** Doubling starts at the body's rightmost digit — where the check digit's
 *  neighbour sits in the finished number. */
export function luhnCheckDigit(withoutCheckDigit: string): number {
  let sum = 0
  for (let i = 0; i < withoutCheckDigit.length; i++) {
    const fromRight = withoutCheckDigit.length - 1 - i
    let digit = Number(withoutCheckDigit[i])
    if (fromRight % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return (10 - (sum % 10)) % 10
}

/** Whether a complete number carries a valid Luhn check digit. */
export function isValidLuhn(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false
  const body = cardNumber.slice(0, -1)
  return luhnCheckDigit(body) === Number(cardNumber.slice(-1))
}

/** 16 digits on the test BIN. Returned to the client exactly once. */
export function generateCardNumber(random: () => number = Math.random): string {
  const middleLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let middle = ""
  for (let i = 0; i < middleLength; i++) {
    middle += Math.floor(random() * 10)
  }
  const body = TEST_BIN + middle
  return body + luhnCheckDigit(body)
}

/** How a card number is shown everywhere except the creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Groups a full number for the one screen that is allowed to show it. */
export function formatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/(.{4})/g, "$1 ").trim()
}

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}
