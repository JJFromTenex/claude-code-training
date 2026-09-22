/**
 * Card number generation for virtual cards.
 * All numbers use the 4242 test BIN and carry a valid Luhn check digit.
 * Nothing here may resemble a real PAN.
 */

function luhnCheckDigit(digits: number[]): number {
  let sum = 0
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits[i]
    // The check digit will sit at distance 0 from right; these payload digits
    // start at distance 1, so even-indexed payload positions (distance 0, 2, …
    // from the right of the payload) map to odd distances in the full number.
    if ((digits.length - 1 - i) % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (10 - (sum % 10)) % 10
}

/** Generate a 16-digit virtual card number starting with the 4242 test BIN. */
export function generateCardNumber(): string {
  const bin = [4, 2, 4, 2]
  const middle: number[] = []
  for (let i = 0; i < 11; i++) {
    middle.push(Math.floor(Math.random() * 10))
  }
  const payload = [...bin, ...middle]
  const check = luhnCheckDigit(payload)
  return [...payload, check].join("")
}

/** Extract the last four digits from a PAN. */
export function last4FromNumber(pan: string): string {
  return pan.slice(-4)
}

/** Verify a card number passes the Luhn check. For tests only. */
export function luhnValid(pan: string): boolean {
  const digits = pan.split("").map(Number)
  const check = digits.pop()!
  return luhnCheckDigit(digits) === check
}
