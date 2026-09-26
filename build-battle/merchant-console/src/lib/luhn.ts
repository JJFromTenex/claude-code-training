/** Validate a card number using the Luhn algorithm. */
export function isValidLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, "").split("").map(Number)

  if (digits.length === 0) return false

  let sum = 0

  for (let i = digits.length - 2; i >= 0; i -= 2) {
    let doubled = digits[i] * 2
    if (doubled > 9) doubled -= 9
    digits[i] = doubled
  }

  for (const digit of digits) {
    sum += digit
  }

  return sum % 10 === 0
}

/** Generate a test card number with 4242 BIN and valid Luhn check digit. */
export function generateCardNumber(): string {
  const bin = "424200"
  const randomDigits = Array(9)
    .fill(0)
    .map(() => Math.floor(Math.random() * 10))
    .join("")

  const partialNumber = bin + randomDigits
  let checkDigit = 0

  let sum = 0
  for (let i = partialNumber.length - 1; i >= 0; i -= 2) {
    let digit = parseInt(partialNumber[i]) * 2
    if (digit > 9) digit -= 9
    sum += digit
  }

  for (let i = partialNumber.length - 2; i >= 0; i -= 2) {
    sum += parseInt(partialNumber[i])
  }

  checkDigit = (10 - (sum % 10)) % 10

  return partialNumber + checkDigit
}

/** Extract last 4 digits from a card number. */
export function getLastFour(cardNumber: string): string {
  return cardNumber.slice(-4)
}
