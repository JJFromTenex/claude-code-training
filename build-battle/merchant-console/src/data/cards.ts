import {
  canTransition,
  generateCardNumber,
  generateNumberReference,
} from "@/lib/cards"
import { formatMoney } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CARD_CATEGORIES,
  CARD_STATUSES,
  CardCategory,
  CardStatus,
  CURRENCIES,
  Currency,
  MAX_SPEND_LIMIT,
} from "./types"

/**
 * Card reads and writes against the in-memory store (NWP-201).
 *
 * Everything the client sends is validated here, against the allowlists in
 * types.ts, before it reaches the store. Route handlers stay thin: they parse
 * JSON, call one of these, and map the result to a response.
 *
 * The generated number is returned to the caller exactly once, from issueCard,
 * and is never written to the card record.
 */

export type CardFailure = { ok: false; status: 400 | 404 | 409; error: string }

export type IssueCardSuccess = {
  ok: true
  card: Card
  /** The one-time reveal. Null on an idempotent replay: a retry re-reveals nothing. */
  number: string | null
  replayed: boolean
}

export type ChangeStatusSuccess = { ok: true; card: Card }

const fail = (status: CardFailure["status"], error: string): CardFailure => ({
  ok: false,
  status,
  error,
})

/** Newest first, ties broken by id descending so the order is stable. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => {
    const byDate = b.createdAt.localeCompare(a.createdAt)
    return byDate !== 0 ? byDate : b.id.localeCompare(a.id)
  })
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function nextCardId(): string {
  return `card_${String(store.cards.length + 1).padStart(4, "0")}`
}

function uniqueNumberReference(): string {
  let reference = generateNumberReference()
  while (store.cards.some((card) => card.numberRef === reference)) {
    reference = generateNumberReference()
  }
  return reference
}

/**
 * Issue a card. Rejects early on the first bad field rather than collecting
 * errors, so a case can never go missing in a nested branch.
 */
export function issueCard(body: unknown): IssueCardSuccess | CardFailure {
  if (!isRecord(body)) return fail(400, "Request body must be an object")

  const { nickname, merchantId, currency, spendLimit, categoryLock } = body

  if (typeof nickname !== "string" || nickname.trim().length === 0) {
    return fail(400, "Give the card a nickname")
  }
  const trimmedNickname = nickname.trim()
  if (trimmedNickname.length > 40) {
    return fail(400, "Nickname must be 40 characters or fewer")
  }

  if (typeof merchantId !== "string" || merchantId.length === 0) {
    return fail(400, "Choose a merchant")
  }
  const merchant = merchantById(merchantId)
  if (!merchant) return fail(400, "Unknown merchant")

  if (
    typeof currency !== "string" ||
    !CURRENCIES.includes(currency as Currency)
  ) {
    return fail(400, "Currency must be USD, EUR, or GBP")
  }
  const issuedCurrency = currency as Currency

  if (issuedCurrency !== merchant.currency) {
    return fail(
      400,
      `${merchant.name} settles in ${merchant.currency}; issue the card in ${merchant.currency}.`,
    )
  }

  // Minor units only. A string or a float is client input that never converted
  // at the boundary, and accepting it here is how a wrong limit gets issued.
  if (!Number.isInteger(spendLimit)) {
    return fail(400, "Spend limit must be a whole number of minor units")
  }
  const limit = spendLimit as number
  if (limit <= 0) return fail(400, "Spend limit must be greater than zero")
  if (limit > MAX_SPEND_LIMIT) {
    return fail(
      400,
      `Spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, issuedCurrency)}`,
    )
  }

  let lock: CardCategory | null = null
  if (categoryLock !== undefined && categoryLock !== null) {
    if (
      typeof categoryLock !== "string" ||
      !CARD_CATEGORIES.includes(categoryLock as CardCategory)
    ) {
      return fail(
        400,
        `Category lock must be one of ${CARD_CATEGORIES.join(", ")}`,
      )
    }
    lock = categoryLock as CardCategory
  }

  const rawKey = body.idempotencyKey
  let idempotencyKey: string | null = null
  if (rawKey !== undefined && rawKey !== null) {
    if (typeof rawKey !== "string" || rawKey.length < 1 || rawKey.length > 128) {
      return fail(400, "Idempotency key must be 1 to 128 characters")
    }
    idempotencyKey = rawKey
  }

  if (idempotencyKey !== null) {
    const existing = store.cards.find(
      (card) => card.idempotencyKey === idempotencyKey,
    )
    // A retry returns the card it already made and mints nothing. The number
    // is null because the reveal already happened on the first response.
    if (existing) {
      return { ok: true, card: existing, number: null, replayed: true }
    }
  }

  const number = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: nextCardId(),
    nickname: trimmedNickname,
    merchantId: merchant.id,
    last4: number.slice(-4),
    numberRef: uniqueNumberReference(),
    spendLimit: limit,
    spent: 0,
    currency: issuedCurrency,
    status: "active",
    categoryLock: lock,
    idempotencyKey,
    createdAt,
    history: [{ from: null, to: "active", at: createdAt }],
  }

  store.cards.push(card)
  return { ok: true, card, number, replayed: false }
}

/** Why a transition was refused, in words ops can act on. */
function refusal(from: CardStatus, to: CardStatus): string {
  if (from === "cancelled") return "A cancelled card cannot be changed"
  if (from === to) return `Card is already ${from}`
  return `A ${from} card cannot become ${to}`
}

export function changeCardStatus(
  id: string,
  body: unknown,
): ChangeStatusSuccess | CardFailure {
  if (!isRecord(body)) return fail(400, "Request body must be an object")

  const { status } = body
  if (typeof status !== "string" || !CARD_STATUSES.includes(status as CardStatus)) {
    return fail(400, `Status must be one of ${CARD_STATUSES.join(", ")}`)
  }
  const next = status as CardStatus

  const card = cardById(id)
  if (!card) return fail(404, "Card not found")

  // The state machine is guarded here, not in the UI: active ⇄ frozen, either
  // to cancelled, and cancelled is terminal.
  if (!canTransition(card.status, next)) {
    return fail(409, refusal(card.status, next))
  }

  card.history.push({
    from: card.status,
    to: next,
    at: new Date().toISOString(),
  })
  card.status = next

  return { ok: true, card }
}
