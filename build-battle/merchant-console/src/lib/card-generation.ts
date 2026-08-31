/**
 * Card number generation for the 4242 test BIN.
 *
 * Every generated number starts with 4242 (Visa test BIN) and carries a
 * valid Luhn check digit. Nothing here may resemble a real PAN.
 */

/** Generate a 16-digit card number on the 4242 test BIN with valid Luhn check digit. */
export function generateCard4242(): string {
  const bin = "4242"
  const middleDigits = Array.from({ length: 11 }, () =>
    Math.floor(Math.random() * 10).toString(),
  ).join("")

  const withoutCheck = bin + middleDigits
  const checkDigit = calculateLuhnCheckDigit(withoutCheck)
  return withoutCheck + checkDigit
}

/** Calculate the Luhn check digit for a 15-digit number. Returns the digit as a string. */
export function calculateLuhnCheckDigit(digits: string): string {
  const sum = digits
    .split("")
    .reverse()
    .reduce((acc, digit, index) => {
      let num = parseInt(digit, 10)
      if (index % 2 === 1) {
        num *= 2
        if (num > 9) {
          num -= 9
        }
      }
      return acc + num
    }, 0)

  const checkDigit = (10 - (sum % 10)) % 10
  return checkDigit.toString()
}

/** Validate a card number using the Luhn algorithm. */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.split("")
  const checkDigit = digits.pop()
  const calculated = calculateLuhnCheckDigit(digits.join(""))
  return checkDigit === calculated
}
