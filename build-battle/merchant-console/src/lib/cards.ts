import { CardStatus } from "@/data/types"

/**
 * Card primitives: number generation, masking, and the status machine.
 *
 * Everything here is pure and server-side. A card number produced in the
 * browser is a bug, so nothing in this module may be imported by a client
 * component.
 */

/** The test BIN. Every generated number starts with it, so nothing here can resemble a real PAN. */
export const TEST_BIN = "4242"

/** Generated numbers are 16 digits: the 4-digit BIN, 11 random, 1 check digit. */
export const CARD_NUMBER_LENGTH = 16

/** Integer minor units. A limit of zero or less is not a limit. */
export const MIN_SPEND_LIMIT_MINOR_UNITS = 1

/** Integer minor units. $50,000.00, per NWP-201. */
export const MAX_SPEND_LIMIT_MINOR_UNITS = 5_000_000

/** Spend at or above this share of the limit is worth flagging on the card. */
export const SPEND_WARNING_PERCENT = 80

/**
 * The Luhn check digit for a payload of digits, which is every digit of the
 * final number except the check digit itself.
 *
 * The payload's rightmost digit lands in a doubled position, because the
 * check digit occupies the undoubled one to its right.
 */
export function luhnCheckDigit(payload: string): number {
  if (!/^\d+$/.test(payload)) {
    throw new Error("Luhn payload must be digits")
  }

  let sum = 0
  let double = true

  for (let i = payload.length - 1; i >= 0; i--) {
    let digit = payload.charCodeAt(i) - 48
    if (double) {
      digit *= 2
      if (digit > 9) digit -= 9
    }
    sum += digit
    double = !double
  }

  return (10 - (sum % 10)) % 10
}

/** Whether a number's trailing digit is the correct Luhn check digit for the rest. */
export function isValidLuhn(cardNumber: string): boolean {
  if (!/^\d{2,}$/.test(cardNumber)) return false
  const payload = cardNumber.slice(0, -1)
  const check = cardNumber.charCodeAt(cardNumber.length - 1) - 48
  return luhnCheckDigit(payload) === check
}

/**
 * A uniform random digit from the platform CSPRNG.
 *
 * Bytes of 250 and above are discarded rather than folded, because `% 10` over
 * all 256 values would make 0–5 likelier than 6–9.
 */
function secureRandomDigit(): number {
  const byte = new Uint8Array(1)
  for (;;) {
    crypto.getRandomValues(byte)
    if (byte[0] < 250) return byte[0] % 10
  }
}

function secureRandomByte(): number {
  const byte = new Uint8Array(1)
  crypto.getRandomValues(byte)
  return byte[0]
}

/**
 * A card number on the test BIN with a valid Luhn check digit.
 *
 * The digit source is injectable so tests can drive it deterministically; it
 * defaults to the CSPRNG.
 */
export function generateCardNumber(
  randomDigit: () => number = secureRandomDigit,
): string {
  const middleLength = CARD_NUMBER_LENGTH - TEST_BIN.length - 1

  let payload = TEST_BIN
  for (let i = 0; i < middleLength; i++) {
    payload += String(randomDigit() % 10)
  }

  return payload + String(luhnCheckDigit(payload))
}

/**
 * An opaque handle for a generated number, stored in place of the number.
 *
 * It is random rather than derived, so holding a reference reveals nothing
 * about the PAN it stands for.
 */
export function generateCardReference(
  randomByte: () => number = secureRandomByte,
): string {
  const hex = Array.from({ length: 8 }, () =>
    (randomByte() % 256).toString(16).padStart(2, "0"),
  )
  return `cref_${hex.join("")}`
}

/** The last four digits of a full number. The only part of it that may be stored. */
export function last4Of(cardNumber: string): string {
  return cardNumber.slice(-4)
}

/**
 * How a card number is written anywhere other than the creation response.
 *
 * NWP-201 illustrates the mask as `•••• 4242`, but `4242` is the BIN and the
 * same ticket says to store the last four. This masks on the stored last four,
 * matching how `src/app/payments/page.tsx` already renders a card.
 */
export function maskLast4(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The status machine. `active ⇄ frozen`, either to `cancelled`, and
 * `cancelled` is terminal — nothing comes back from it.
 */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const CARD_STATUSES = Object.keys(CARD_TRANSITIONS) as CardStatus[]

export function isCardStatus(value: unknown): value is CardStatus {
  // `in` would walk the prototype chain and say yes to "toString".
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(CARD_TRANSITIONS, value)
  )
}

/**
 * Whether a card may move from one status to another.
 *
 * Guarded here and called by the route handler, so a hand-made request cannot
 * walk a cancelled card back to active.
 */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

/**
 * Spend as a percentage of the limit, for display.
 *
 * Both amounts are integer minor units in the same currency; the division
 * happens here, at the edge, and the result is never stored or compared as
 * money.
 */
export function spendPercent(spend: number, spendLimit: number): number {
  if (spendLimit <= 0) return 0
  return Math.min(100, Math.floor((spend * 100) / spendLimit))
}
