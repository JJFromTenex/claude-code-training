import { CardCategory, CardStatus, Currency, IssueCardInput } from "@/data/types"

/**
 * Everything the card rules are about, in one place: number generation on the
 * test BIN, masking, the status state machine, and input validation.
 * Nothing here touches the store; see src/data/cards.ts for that.
 */

/** Test BIN. Every number we ever generate starts with this. */
export const TEST_BIN = "4242"
export const CARD_LENGTH = 16

/** Ceiling from NWP-201: 5,000,000 minor units. */
export const MAX_LIMIT_MINOR = 5_000_000

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
export const CATEGORIES: readonly CardCategory[] = [
  "subscriptions",
  "advertising",
  "contractors",
  "travel",
  "general",
]

/** Luhn check digit for a partial number (all digits except the last). */
export function luhnCheckDigit(partial: string): string {
  let sum = 0
  // Walk right-to-left over the partial; the check digit will sit at position 0
  // of the reversed full number, so the first partial digit from the right is doubled.
  for (let i = partial.length - 1, double = true; i >= 0; i--, double = !double) {
    let d = Number(partial[i])
    if (double) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return String((10 - (sum % 10)) % 10)
}

/** True when a full number passes the Luhn check. */
export function isValidLuhn(number: string): boolean {
  if (!/^\d+$/.test(number) || number.length < 2) return false
  return luhnCheckDigit(number.slice(0, -1)) === number.slice(-1)
}

/**
 * Generate a 16-digit number on the test BIN with a valid Luhn digit.
 * `random` is injectable so tests are deterministic.
 */
export function generateCardNumber(random: () => number = Math.random): string {
  const bodyLength = CARD_LENGTH - TEST_BIN.length - 1
  let body = ""
  for (let i = 0; i < bodyLength; i++) body += Math.floor(random() * 10)
  const partial = TEST_BIN + body
  return partial + luhnCheckDigit(partial)
}

/** `•••• 4242` — the only form a number takes outside the issue response. */
export function maskNumber(last4: string): string {
  return `•••• ${last4}`
}

/**
 * The state machine. active ⇄ frozen, either to cancelled, cancelled terminal.
 * Guarded on the server in the PATCH handler; the UI only reflects it.
 */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}

export type ValidationResult =
  | { ok: true; value: IssueCardInput }
  | { ok: false; error: string }

/**
 * Validate an issue request from the client. Allowlists only. Returns a
 * message safe to show a user. Order is deliberate: the first thing wrong
 * is the thing we report.
 */
export function validateIssueInput(raw: unknown, knownMerchantIds: readonly string[]): ValidationResult {
  if (!raw || typeof raw !== "object") return { ok: false, error: "Request body must be an object." }
  const body = raw as Record<string, unknown>

  const merchantId = typeof body.merchantId === "string" ? body.merchantId.trim() : ""
  if (!merchantId) return { ok: false, error: "Choose a merchant." }
  if (!knownMerchantIds.includes(merchantId)) return { ok: false, error: "Unknown merchant." }

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) return { ok: false, error: "Give the card a nickname." }
  if (nickname.length > 60) return { ok: false, error: "Nickname must be 60 characters or fewer." }

  const limit = body.limit
  if (typeof limit !== "number" || !Number.isInteger(limit)) {
    return { ok: false, error: "Spend limit must be a whole number of minor units." }
  }
  if (limit <= 0) return { ok: false, error: "Spend limit must be greater than zero." }
  if (limit > MAX_LIMIT_MINOR) {
    return { ok: false, error: `Spend limit cannot exceed ${MAX_LIMIT_MINOR.toLocaleString("en-US")} minor units.` }
  }

  const currency = body.currency
  if (typeof currency !== "string" || !CURRENCIES.includes(currency as Currency)) {
    return { ok: false, error: "Currency must be USD, EUR, or GBP." }
  }

  const category = typeof body.category === "string" ? body.category : "general"
  if (!CATEGORIES.includes(category as CardCategory)) {
    return { ok: false, error: "Unknown merchant category." }
  }

  return {
    ok: true,
    value: {
      merchantId,
      nickname,
      limit,
      currency: currency as Currency,
      category: category as CardCategory,
    },
  }
}
