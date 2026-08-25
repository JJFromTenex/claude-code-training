/**
 * Card number generation and masking.
 *
 * Pure helpers with no data dependency, so both the seed generator and the
 * route handler can reach them. A generated number lives only as a return
 * value on its way to the creation response — nothing stores one.
 */

/** Every generated number starts here. Nothing in this repo may resemble a real PAN. */
export const TEST_BIN = "4242"

const CARD_NUMBER_LENGTH = 16

/**
 * Luhn check digit for a partial number.
 *
 * The returned digit sits in the rightmost position, so the last digit of
 * `partial` falls in a doubled position.
 */
function luhnCheckDigit(partial: string): number {
  let sum = 0
  let double = true

  for (let i = partial.length - 1; i >= 0; i--) {
    let value = partial.charCodeAt(i) - 48
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    double = !double
    sum += value
  }

  return (10 - (sum % 10)) % 10
}

/** Whether a complete number satisfies Luhn. */
export function isLuhnValid(cardNumber: string): boolean {
  if (!/^\d+$/.test(cardNumber)) return false

  let sum = 0
  let double = false

  for (let i = cardNumber.length - 1; i >= 0; i--) {
    let value = cardNumber.charCodeAt(i) - 48
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    double = !double
    sum += value
  }

  return sum % 10 === 0
}

/**
 * A 16-digit number on the test BIN with a valid check digit.
 *
 * Server-side only; a number produced in the browser is a bug. `random` is
 * injectable so seed generation stays deterministic — route handlers take
 * the default.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  let partial = TEST_BIN
  while (partial.length < CARD_NUMBER_LENGTH - 1) {
    partial += Math.floor(random() * 10)
  }
  return partial + luhnCheckDigit(partial)
}

/** How a card number is written anywhere that is not the creation response. */
export function maskedNumber(last4: string): string {
  return `•••• ${last4}`
}
