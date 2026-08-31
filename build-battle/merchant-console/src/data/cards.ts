import { generateCardNumber, last4 as lastFourOf } from "@/lib/cardNumber"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CARD_CATEGORIES,
  CardCategory,
  CardStatus,
  Currency,
} from "./types"

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const MAX_LIMIT = 5_000_000

const pad = (n: number) => String(n).padStart(4, "0")

/**
 * Derived from the persisted store, not a module-level counter — Next's dev
 * server can re-instantiate this module between requests, and a plain
 * `let seq` would silently reset and hand out a duplicate id.
 */
function nextCardId(): string {
  return `card_${pad(store.cards.length + 1)}`
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export interface CardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category: CardCategory | null
}

export type CardInputErrors = Partial<Record<keyof CardInput, string>>

/**
 * The allowlist gate for card creation. Anything from the client is checked
 * here before it reaches the store — a bad merchant id, limit, or currency
 * never gets past this function.
 */
export function parseCardInput(body: unknown): {
  data: CardInput | null
  errors: CardInputErrors
} {
  const errors: CardInputErrors = {}
  const raw = (body ?? {}) as Record<string, unknown>

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (!nickname) errors.nickname = "Nickname is required."

  const merchantId =
    typeof raw.merchantId === "string" ? raw.merchantId : ""
  const merchant = merchantById(merchantId)
  if (!merchantId || !merchant) {
    errors.merchantId = "Choose a valid merchant."
  }

  const limit = typeof raw.limit === "number" ? raw.limit : NaN
  if (!Number.isInteger(limit) || limit <= 0) {
    errors.limit = "Limit must be a whole number of minor units greater than zero."
  } else if (limit > MAX_LIMIT) {
    errors.limit = `Limit cannot exceed ${MAX_LIMIT.toLocaleString()} minor units.`
  }

  const currency = raw.currency as Currency
  if (!CURRENCIES.includes(currency)) {
    errors.currency = "Currency must be USD, EUR, or GBP."
  } else if (merchant && currency !== merchant.currency) {
    // A card can't settle in a currency the merchant doesn't operate in —
    // the client should never offer the choice, but this is the real gate.
    errors.currency = `Currency must match the merchant's currency (${merchant.currency}).`
  }

  const categoryRaw = raw.category
  let category: CardCategory | null = null
  if (categoryRaw != null && categoryRaw !== "") {
    if (!CARD_CATEGORIES.includes(categoryRaw as CardCategory)) {
      errors.category = "Unrecognized category."
    } else {
      category = categoryRaw as CardCategory
    }
  }

  if (Object.keys(errors).length > 0) return { data: null, errors }

  return {
    data: { nickname, merchantId, limit, currency, category },
    errors: {},
  }
}

/**
 * Creates a card and returns the full number alongside it. This is the one
 * and only place the full number ever exists — the caller must hand it to
 * the client in this response and never read it back. The store only ever
 * receives `last4`.
 */
export function createCard(input: CardInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    limit: input.limit,
    currency: input.currency,
    status: "active",
    last4: lastFourOf(number),
    spend: 0,
    category: input.category,
    createdAt: new Date().toISOString(),
  }
  store.cards.push(card)
  return { card, number }
}

const ALLOWED_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}

/**
 * Guards the status state machine server-side. Returns null (not a thrown
 * error) on an illegal transition, so callers can turn that into a 409
 * without a try/catch.
 */
export function setCardStatus(id: string, next: CardStatus): Card | null {
  const card = cardById(id)
  if (!card) return null
  if (!canTransition(card.status, next)) return null
  card.status = next
  return card
}
