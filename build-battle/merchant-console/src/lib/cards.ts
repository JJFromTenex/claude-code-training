import { randomInt } from "node:crypto"

/**
 * Card numbers are generated on the server only, on the 4242 test BIN, with
 * a valid Luhn check digit. Nothing here may resemble a real PAN.
 */

const BIN = "4242"
const NUMBER_LENGTH = 16

/** Standard mod-10 Luhn check digit for the digits that precede it. */
export function luhnCheckDigit(digits: string): number {
  let sum = 0
  let double = true // rightmost of the given digits doubles first

  for (let i = digits.length - 1; i >= 0; i--) {
    let value = Number(digits[i])
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }

  return (10 - (sum % 10)) % 10
}

/** A 16-digit number on the 4242 BIN with a valid trailing Luhn digit. */
export function generateCardNumber(): string {
  let body = BIN
  while (body.length < NUMBER_LENGTH - 1) {
    body += randomInt(0, 10)
  }
  return body + luhnCheckDigit(body)
}

/**
 * Display form for every masked card. This is the one call site: switching
 * between "always the literal 4242 suffix" and "this card's real last four"
 * is a one-line change here, nowhere else.
 */
export function maskCardNumber(last4: string): string {
  // Literal reading per the ticket/cards.md wording, both verbatim "•••• 4242".
  // If that reading is wrong, this function is the only place to change.
  return "•••• 4242"
}
