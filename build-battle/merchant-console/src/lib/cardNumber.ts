/**
 * Virtual card number generation. Server only — a number produced in the
 * browser is a bug.
 *
 * Every number is 16 digits: the 4242 test BIN, eleven random digits, and a
 * Luhn check digit. Nothing generated here may resemble a real PAN.
 */

export const TEST_BIN = "4242"
export const PAN_LENGTH = 16

/**
 * The Luhn check digit for a partial number, i.e. the digit that makes
 * `partial + checkDigit` satisfy the Luhn checksum.
 *
 * Doubling starts at the partial's rightmost digit because the check digit
 * that will follow it occupies the undoubled position.
 */
export function luhnCheckDigit(partial: string): number {
  let sum = 0
  let double = true
  for (let i = partial.length - 1; i >= 0; i--) {
    let digit = Number(partial[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return (10 - (sum % 10)) % 10
}

export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let digit = Number(number[i])
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }
  return sum % 10 === 0
}

/**
 * The full number is returned here and travels no further than the creation
 * response. Only the last four are ever stored.
 */
export function generateCardNumber(): { full: string; last4: string } {
  const randomLength = PAN_LENGTH - TEST_BIN.length - 1
  let partial = TEST_BIN
  for (let i = 0; i < randomLength; i++) {
    partial += String(Math.floor(Math.random() * 10))
  }
  const full = partial + String(luhnCheckDigit(partial))
  return { full, last4: full.slice(-4) }
}

/** Display form. The only masking format in the codebase. */
export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}
