/**
 * Card number generation and masking.
 *
 * Every number this file produces starts with the 4242 test BIN and carries a
 * valid Luhn check digit, so nothing in this repository can resemble a real
 * PAN. Generation is server side only: a number produced in the browser is a
 * bug (`.claude/rules/cards.md`).
 *
 * Nothing here reaches the store. The full number lives only as the return
 * value of an issue call; the record keeps the last four and a reference.
 */

/** The only BIN allowed anywhere in this codebase, fixtures included. */
export const TEST_BIN = "4242"

/** Total digits in a generated number. */
export const CARD_NUMBER_LENGTH = 16

const MASK = "••••"

/**
 * The Luhn check digit for a body of digits, assuming the check digit will be
 * appended to the right of it.
 */
export function luhnCheckDigit(body: string): number {
  if (!/^\d+$/.test(body)) {
    throw new Error("luhnCheckDigit expects digits only")
  }

  let sum = 0
  // The digit adjacent to the check digit doubles, and alternates from there.
  let double = true

  for (let i = body.length - 1; i >= 0; i--) {
    let digit = body.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return (10 - (sum % 10)) % 10
}

/** Whether a full number, check digit included, satisfies Luhn. */
export function isValidLuhn(cardNumber: string): boolean {
  if (!/^\d{2,}$/.test(cardNumber)) return false
  const body = cardNumber.slice(0, -1)
  const check = cardNumber.charCodeAt(cardNumber.length - 1) - 48
  return luhnCheckDigit(body) === check
}

/**
 * A 16 digit number on the test BIN with a valid check digit.
 *
 * `random` is injectable so tests can pin the output; production callers pass
 * nothing and get `Math.random`.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const filler = CARD_NUMBER_LENGTH - TEST_BIN.length - 1
  let body = TEST_BIN
  for (let i = 0; i < filler; i++) {
    body += String(Math.floor(random() * 10))
  }
  return body + String(luhnCheckDigit(body))
}

/** The last four of a full number. The only digits a record may keep. */
export function lastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/** How a card number is shown everywhere except the creation response. */
export function maskCardNumber(last4: string): string {
  return `${MASK} ${last4}`
}

/** Groups a full number into readable blocks. Reveal screen only. */
export function formatCardNumber(cardNumber: string): string {
  return cardNumber.replace(/(.{4})(?=.)/g, "$1 ")
}
