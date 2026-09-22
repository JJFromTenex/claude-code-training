import { randomInt, randomUUID } from "node:crypto"
import { Card } from "@/data/types"

/**
 * Card numbers are generated here, on the server, on the 4242 test BIN with a
 * valid Luhn check digit, so nothing in this repository can resemble a real
 * PAN. The full number is returned once by the create handler and never
 * stored; only the last four and an opaque reference survive.
 */

/** The only BIN this codebase issues on. */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/** Luhn sum over a digit string, doubling every second digit from the right. */
function luhnSum(digits: string): number {
  let sum = 0
  for (let i = digits.length - 1, position = 0; i >= 0; i--, position++) {
    let digit = digits.charCodeAt(i) - 48
    if (position % 2 === 1) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return sum
}

/** The digit that makes `payload` + itself a Luhn-valid number. */
export function luhnCheckDigit(payload: string): number {
  return (10 - (luhnSum(`${payload}0`) % 10)) % 10
}

/** Whether a complete number carries a valid Luhn check digit. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  return luhnSum(number) % 10 === 0
}

/** A 16-digit number on the test BIN. Crypto random, never the seed PRNG. */
export function generateCardNumber(bin = TEST_BIN): string {
  const bodyLength = CARD_NUMBER_LENGTH - bin.length - 1
  let payload = bin
  for (let i = 0; i < bodyLength; i++) payload += randomInt(0, 10)
  return `${payload}${luhnCheckDigit(payload)}`
}

/** Opaque stand-in for the network reference. Not derived from the number. */
export function cardReference(): string {
  return `cref_${randomUUID()}`
}

/** How a card number appears everywhere except the one creation response. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}

/** Next id in the house sequence, read off the existing cards rather than a counter. */
export function nextCardId(cards: Card[]): string {
  const highest = cards.reduce((max, card) => {
    const suffix = Number(card.id.replace("card_", ""))
    return Number.isFinite(suffix) && suffix > max ? suffix : max
  }, 0)
  return `card_${String(highest + 1).padStart(6, "0")}`
}
