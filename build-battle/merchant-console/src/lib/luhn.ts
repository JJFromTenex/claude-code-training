import { randomBytes } from "crypto"

const TEST_BIN = "4242"

export function luhnCheckDigit(partial: string): string {
  const digits = partial.split("").map(Number).reverse()
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i]
    if (i % 2 === 0) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number)) return false
  const digits = number.split("").map(Number).reverse()
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i]
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return sum % 10 === 0
}

export function generateCardNumber(): string {
  const bytes = randomBytes(11)
  let middle = ""
  for (let i = 0; i < 11; i++) {
    middle += String(bytes[i] % 10)
  }
  const partial = TEST_BIN + middle
  return partial + luhnCheckDigit(partial)
}
