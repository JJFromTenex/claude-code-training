import {
  SPEND_LIMIT_MAX,
  canTransition,
  generateCardNumber,
  isCardCategory,
  isCurrency,
  lastFour,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardCategory, CardStatus, Currency } from "./types"

/**
 * Card reads and writes against the in-memory store.
 *
 * Everything arriving from the client passes through parseIssueRequest before
 * it reaches the store, so a route handler never reads a raw field itself.
 */

const NICKNAME_LENGTH_MAX = 60

export interface IssueInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory | null
  requestId: string | null
}

export interface FieldError {
  field: string
  message: string
}

export type ParseResult =
  | { ok: true; input: IssueInput }
  | { ok: false; errors: FieldError[] }

/**
 * Checks an issue request field by field and returns every problem at once,
 * so the form can mark all of them rather than one per round trip.
 */
export function parseIssueRequest(body: unknown): ParseResult {
  const errors: FieldError[] = []
  const raw = (body ?? {}) as Record<string, unknown>

  const nickname = typeof raw.nickname === "string" ? raw.nickname.trim() : ""
  if (!nickname) {
    errors.push({ field: "nickname", message: "Give the card a nickname." })
  } else if (nickname.length > NICKNAME_LENGTH_MAX) {
    errors.push({
      field: "nickname",
      message: `Keep the nickname under ${NICKNAME_LENGTH_MAX} characters.`,
    })
  }

  const merchantId = typeof raw.merchantId === "string" ? raw.merchantId : ""
  const merchant = merchantId ? merchantById(merchantId) : undefined
  if (!merchant) {
    errors.push({ field: "merchantId", message: "Choose a merchant." })
  }

  const spendLimit = raw.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    errors.push({
      field: "spendLimit",
      message: "Enter a spend limit in minor units.",
    })
  } else if (spendLimit <= 0) {
    errors.push({
      field: "spendLimit",
      message: "The spend limit must be above zero.",
    })
  } else if (spendLimit > SPEND_LIMIT_MAX) {
    errors.push({
      field: "spendLimit",
      message: "The spend limit cannot exceed 5,000,000 minor units.",
    })
  }

  const currency = typeof raw.currency === "string" ? raw.currency : ""
  if (!isCurrency(currency)) {
    errors.push({ field: "currency", message: "Choose USD, EUR, or GBP." })
  } else if (merchant && currency !== merchant.currency) {
    // Nobody asked for this, but a card in a currency its merchant does not
    // settle in is a support ticket the first time it is used.
    errors.push({
      field: "currency",
      message: `${merchant.name} settles in ${merchant.currency}.`,
    })
  }

  const category = raw.categoryLock
  let categoryLock: CardCategory | null = null
  if (category !== null && category !== undefined && category !== "") {
    if (typeof category === "string" && isCardCategory(category)) {
      categoryLock = category
    } else {
      errors.push({
        field: "categoryLock",
        message: "That is not a category we lock to.",
      })
    }
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    input: {
      nickname,
      merchantId,
      spendLimit: spendLimit as number,
      currency: currency as Currency,
      categoryLock,
      requestId: typeof raw.requestId === "string" ? raw.requestId : null,
    },
  }
}

/** Cards newest first, which is the order ops reads them in. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/** The card a previous request with this id already created, if there is one. */
export function cardByRequestId(requestId: string): Card | null {
  return store.cards.find((card) => card.requestId === requestId) ?? null
}

function nextCardId(): string {
  return `card_${String(store.cards.length + 1).padStart(4, "0")}`
}

/**
 * Creates a card and returns it alongside its number.
 *
 * The number is returned here and never stored, so this is the only moment it
 * exists. Callers pass it to the creation response and let it go.
 */
export function issueCard(input: IssueInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const now = new Date().toISOString()

  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(number),
    spendLimit: input.spendLimit,
    // Nothing in this store links a payment to a card, so spend starts at zero
    // and stays there rather than being invented.
    spent: 0,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt: now,
    history: [{ at: now, from: null, to: "active" }],
    requestId: input.requestId,
  }

  store.cards.push(card)
  return { card, number }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "illegal"; message: string }

/**
 * Moves a card to a new status, refusing anything the state machine forbids.
 *
 * The guard lives here rather than in the UI, so a hand-made request cannot
 * revive a cancelled card.
 */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) {
    return { ok: false, reason: "not_found", message: "No such card." }
  }

  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      reason: "illegal",
      message:
        card.status === "cancelled"
          ? "A cancelled card cannot change status."
          : `A ${card.status} card cannot become ${to}.`,
    }
  }

  card.history.push({ at: new Date().toISOString(), from: card.status, to })
  card.status = to
  return { ok: true, card }
}
