import { CardStatus } from "@/data/types"

/**
 * Virtual card primitives: number generation, masking, and the status state
 * machine. Pure — nothing here touches the store, so it tests in plain Node.
 *
 * Every number this module produces starts with the 4242 test BIN, so nothing
 * in this repository can resemble a real PAN.
 */

export const CARD_BIN = "4242"
export const CARD_LENGTH = 16

/** The digit that makes `partial + digit` pass the Luhn checksum. */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  for (let i = 0; i < partial.length; i++) {
    // Counting from the right of the finished number, the digit next to the
    // check digit is the first one that doubles.
    let digit = Number(partial[partial.length - 1 - i])
    if (i % 2 === 0) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
  }
  return String((10 - (sum % 10)) % 10)
}

export function isLuhnValid(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  return luhnCheckDigit(number.slice(0, -1)) === number.slice(-1)
}

/**
 * A 16-digit number on the test BIN with a valid check digit. Server-side
 * only. `random` is injectable so a test can pin the body.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let body = CARD_BIN
  while (body.length < CARD_LENGTH - 1) {
    body += String(Math.floor(random() * 10))
  }
  return body + luhnCheckDigit(body)
}

/** How a card reads everywhere except the one-time reveal. */
export function maskCard(last4: string): string {
  return `•••• ${last4}`
}

/** Groups of four for the success screen, the only place a full number renders. */
export function formatCardNumber(number: string): string {
  return number.replace(/(\d{4})(?=\d)/g, "$1 ")
}

/**
 * active ⇄ frozen, either to cancelled, cancelled is terminal. The single
 * source of truth for both the PATCH handler and the row actions.
 */
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}
