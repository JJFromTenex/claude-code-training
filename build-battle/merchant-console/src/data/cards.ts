import {
  CARD_CURRENCIES,
  MAX_SPEND_LIMIT,
  MIN_SPEND_LIMIT,
  canTransition,
  generateCardNumber,
} from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardEvent, CardInput, CardStatus, MerchantCategory } from "./types"

const CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "utilities",
]

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((c) => c.id === id)
}

/**
 * The allowlist. Everything from the client goes through here before it
 * reaches the store. `spendLimit` may arrive as a string like "250.00" and is
 * converted once, by parseAmountToMinorUnits() from src/lib/money.ts.
 */
export function parseCardInput(
  body: unknown,
): { ok: true; value: CardInput } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Choose a merchant." }
  }
  const b = body as Record<string, unknown>

  const merchantId = typeof b.merchantId === "string" ? b.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    return { ok: false, message: "Choose a merchant." }
  }

  const nickname = typeof b.nickname === "string" ? b.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Give the card a nickname." }
  }

  const rawSpendLimit = b.spendLimit
  const spendLimit =
    typeof rawSpendLimit === "number"
      ? Number.isFinite(rawSpendLimit)
        ? Math.trunc(rawSpendLimit)
        : null
      : typeof rawSpendLimit === "string"
        ? parseAmountToMinorUnits(rawSpendLimit)
        : null

  if (spendLimit === null) {
    return { ok: false, message: "Enter a limit like 250 or 250.00." }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "The spend limit must be more than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      message: "The spend limit cannot exceed 50,000.00.",
    }
  }
  if (spendLimit < MIN_SPEND_LIMIT) {
    return { ok: false, message: "The spend limit must be more than zero." }
  }

  const currency = b.currency
  if (
    typeof currency !== "string" ||
    !CARD_CURRENCIES.includes(currency as (typeof CARD_CURRENCIES)[number])
  ) {
    return { ok: false, message: "Currency must be USD, EUR, or GBP." }
  }

  // Merchant match is checked after the allowlist so an unknown currency like
  // "JPY" still gets its own message; only a currency that IS on the
  // allowlist but doesn't match this merchant gets the more specific one.
  const merchant = merchantById(merchantId)
  if (merchant && currency !== merchant.currency) {
    return {
      ok: false,
      message: `${merchant.name} settles in ${merchant.currency}; this card must use ${merchant.currency}.`,
    }
  }

  let category: MerchantCategory | null = null
  if (b.category !== undefined && b.category !== null) {
    if (
      typeof b.category !== "string" ||
      !CATEGORIES.includes(b.category as MerchantCategory)
    ) {
      return { ok: false, message: "Choose a valid category." }
    }
    category = b.category as MerchantCategory
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit,
      currency: currency as CardInput["currency"],
      category,
    },
  }
}

let cardSequence = store.cards.length
let cardEventSequence = store.cardEvents.length

function appendCardEvent(cardId: string, from: CardStatus | null, to: CardStatus): void {
  cardEventSequence += 1
  store.cardEvents.push({
    id: `cev_${String(cardEventSequence).padStart(4, "0")}`,
    cardId,
    from,
    to,
    at: new Date().toISOString(),
  })
}

/** A card's history, oldest first. What the detail page renders. */
export function cardEventsFor(cardId: string): CardEvent[] {
  return store.cardEvents
    .filter((e) => e.cardId === cardId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

/**
 * Generates the number, stores last4 + reference, returns the full number to
 * the caller exactly once. `fullNumber` is never written to the store.
 *
 * `idempotencyKey` guards a double-clicked issue form: replaying a key that
 * has already issued a card returns that card again (`replay: true`) instead
 * of creating a second one. Because reveal-once means the full number exists
 * in exactly one response ever, a replay never carries `fullNumber` — the
 * route returns 200 with the existing card on replay, 201 with the number on
 * first issue.
 */
export function createCard(
  input: CardInput,
  idempotencyKey?: string,
): { card: Card; fullNumber?: string; replay: boolean } {
  if (idempotencyKey) {
    const existingId = store.issueKeys[idempotencyKey]
    if (existingId) {
      const existing = cardById(existingId)
      if (existing) {
        return { card: existing, replay: true }
      }
    }
  }

  const fullNumber = generateCardNumber()
  const last4 = fullNumber.slice(-4)

  cardSequence += 1
  const id = `crd_${String(cardSequence).padStart(2, "0")}`
  const reference = `cref_${String(cardSequence).padStart(8, "0")}`

  const card: Card = {
    id,
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    brand: "visa",
    last4,
    reference,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  appendCardEvent(card.id, null, "active")

  if (idempotencyKey) {
    store.issueKeys[idempotencyKey] = card.id
  }

  return { card, fullNumber, replay: false }
}

export function setCardStatus(
  id: string,
  next: CardStatus,
): { ok: true; card: Card } | { ok: false; status: 404 | 409; message: string } {
  const card = cardById(id)
  if (!card) {
    return { ok: false, status: 404, message: "No card with that id." }
  }

  if (!canTransition(card.status, next)) {
    const message =
      card.status === "cancelled"
        ? "A cancelled card cannot change status."
        : `That card is already ${card.status}.`
    return { ok: false, status: 409, message }
  }

  const from = card.status
  card.status = next
  appendCardEvent(card.id, from, next)
  return { ok: true, card }
}
