import { merchantById } from "@/data/merchants"
import { CARD_CATEGORIES, CardCategory, CardStatus, Currency } from "@/data/types"

/**
 * Card numbers are generated server-side on the 4242 test BIN with a valid
 * Luhn check digit. Nothing here may resemble a real PAN.
 */

const BIN = "4242"

function luhnCheckDigit(payload: string): number {
  let sum = 0
  let double = true
  for (let i = payload.length - 1; i >= 0; i--) {
    let d = Number(payload[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return (sum * 9) % 10
}

/** Full Luhn checksum validation, including the check digit itself. */
export function isValidLuhn(number: string): boolean {
  let sum = 0
  let double = false
  for (let i = number.length - 1; i >= 0; i--) {
    let d = Number(number[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
    double = !double
  }
  return sum % 10 === 0
}

/** A 16-digit number on the 4242 BIN with a valid Luhn check digit. */
export function generateCardNumber(): string {
  let middle = ""
  for (let i = 0; i < 11; i++) middle += Math.floor(Math.random() * 10)
  const payload = BIN + middle
  return payload + luhnCheckDigit(payload)
}

/**
 * Status is a state machine: active ⇄ frozen, either can go to cancelled,
 * and cancelled is terminal. Guarded here so the server enforces it, not
 * just the UI.
 */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  if (from === "cancelled") return false
  if (from === to) return false
  if (to === "cancelled") return true
  return (from === "active" && to === "frozen") || (from === "frozen" && to === "active")
}

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const SPEND_LIMIT_MAX = 5_000_000

export interface CreateCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: CardCategory | null
  /** Client-generated, one per issue attempt. Guards against issuing twice. */
  requestId: string
}

type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string }

/**
 * Anything from the client is checked here before it reaches the store.
 * The body is untyped input, not a trusted shape.
 */
export function validateCreateCardInput(body: unknown): ValidationResult<CreateCardInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object." }
  }
  const b = body as Record<string, unknown>

  const nickname = typeof b.nickname === "string" ? b.nickname.trim() : ""
  if (!nickname) return { ok: false, error: "Nickname is required." }

  const merchantId = typeof b.merchantId === "string" ? b.merchantId : ""
  const merchant = merchantId ? merchantById(merchantId) : undefined
  if (!merchant) {
    return { ok: false, error: "Select a valid merchant." }
  }

  if (
    typeof b.spendLimit !== "number" ||
    !Number.isInteger(b.spendLimit) ||
    b.spendLimit <= 0
  ) {
    return { ok: false, error: "Spend limit must be a positive whole number of minor units." }
  }
  if (b.spendLimit > SPEND_LIMIT_MAX) {
    return { ok: false, error: "Spend limit cannot exceed 5,000,000 minor units." }
  }

  if (typeof b.currency !== "string" || !CURRENCIES.includes(b.currency as Currency)) {
    return { ok: false, error: "Currency must be USD, EUR, or GBP." }
  }
  if (b.currency !== merchant.currency) {
    return {
      ok: false,
      error: `Currency must match the merchant's currency (${merchant.currency}).`,
    }
  }

  let category: CardCategory | null = null
  if (b.category !== undefined && b.category !== null) {
    if (typeof b.category !== "string" || !CARD_CATEGORIES.includes(b.category as CardCategory)) {
      return { ok: false, error: "Unknown category." }
    }
    category = b.category as CardCategory
  }

  if (typeof b.requestId !== "string" || !b.requestId.trim()) {
    return { ok: false, error: "Request id is required." }
  }

  return {
    ok: true,
    data: {
      nickname,
      merchantId,
      spendLimit: b.spendLimit,
      currency: b.currency as Currency,
      category,
      requestId: b.requestId,
    },
  }
}

const STATUSES: readonly CardStatus[] = ["active", "frozen", "cancelled"]

export function validateStatusUpdate(body: unknown): ValidationResult<{ status: CardStatus }> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object." }
  }
  const status = (body as Record<string, unknown>).status
  if (typeof status !== "string" || !STATUSES.includes(status as CardStatus)) {
    return { ok: false, error: "Status must be active, frozen, or cancelled." }
  }
  return { ok: true, data: { status: status as CardStatus } }
}
