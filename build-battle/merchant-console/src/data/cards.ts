import {
  canTransition,
  CARD_ACTIONS,
  CardAction,
  generateCardNumber,
} from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CARD_CATEGORIES,
  CardCategory,
  CardEvent,
  CURRENCIES,
  Currency,
} from "./types"

/**
 * Issuing, listing, and moving a card through its status machine.
 *
 * Validation lives here rather than inline in the route so that the rules the
 * ticket cares about can be asserted in a test as well as over HTTP. The route
 * is the only caller and it does not second-guess any of it.
 */

export const MAX_SPEND_LIMIT = 5_000_000

export interface IssueValues {
  nickname: string
  merchantId: string
  /** Integer minor units, already converted at the client boundary. */
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory | null
}

export interface Rejection {
  status: number
  message: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

/**
 * Everything the client sends, checked against an allowlist before it reaches
 * the store. Rejects early and returns; the caller narrows on `message`.
 */
export function parseIssue(body: unknown): IssueValues | Rejection {
  if (!isRecord(body)) return { status: 400, message: "Send a JSON object." }
  const { nickname, merchantId, spendLimit, currency, categoryLock } = body

  if (typeof nickname !== "string" || !nickname.trim()) {
    return {
      status: 400,
      message: "Give the card a nickname so ops can recognise it later.",
    }
  }
  if (nickname.trim().length > 60) {
    return {
      status: 400,
      message: "The nickname must be 60 characters or fewer.",
    }
  }

  const merchant =
    typeof merchantId === "string" ? merchantById(merchantId) : undefined
  if (!merchant) {
    return { status: 400, message: "Choose the merchant this card belongs to." }
  }

  // Money arrives as integer minor units. The one string-to-integer conversion
  // happens in the form, through parseAmountToMinorUnits; nothing parses a
  // currency string here.
  if (typeof spendLimit !== "number" || !Number.isFinite(spendLimit)) {
    return {
      status: 400,
      message: "The spend limit must be a number of minor units.",
    }
  }
  if (!Number.isInteger(spendLimit)) {
    return {
      status: 400,
      message: "The spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return {
      status: 400,
      message: "The spend limit must be greater than zero.",
    }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      status: 400,
      message: "The spend limit cannot be above 5,000,000 minor units.",
    }
  }

  if (!CURRENCIES.includes(currency as Currency)) {
    return { status: 400, message: "The currency must be USD, EUR, or GBP." }
  }
  // A card in a currency its merchant cannot settle is a payout problem later.
  if (currency !== merchant.currency) {
    return {
      status: 422,
      message: `${merchant.name} settles in ${merchant.currency}, so this card has to be ${merchant.currency}.`,
    }
  }

  if (
    categoryLock != null &&
    !CARD_CATEGORIES.includes(categoryLock as CardCategory)
  ) {
    return { status: 400, message: "That category lock is not one we support." }
  }

  return {
    nickname: nickname.trim(),
    merchantId: merchant.id,
    spendLimit,
    currency: currency as Currency,
    categoryLock: (categoryLock as CardCategory) ?? null,
  }
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export function eventsForCard(cardId: string): CardEvent[] {
  return store.cardEvents.filter((event) => event.cardId === cardId)
}

/**
 * The one place a card number is generated. The number leaves as a return
 * value and is never assigned to the record, which has no field that could
 * hold it — so no later reader can recover it.
 *
 * A repeated submit carrying the same idempotency key replays the card it
 * already minted, and deliberately does not reveal the number a second time.
 */
export function issueCard(
  values: IssueValues,
  idempotencyKey: string | null,
): { card: Card; fullNumber: string | null } | Rejection {
  const fingerprint = JSON.stringify(values)

  if (idempotencyKey) {
    const seen = store.cardKeys.find((k) => k.key === idempotencyKey)
    if (seen && seen.fingerprint !== fingerprint) {
      return {
        status: 409,
        message:
          "That idempotency key was already used for a different card. Use a fresh key.",
      }
    }
    if (seen) return { card: cardById(seen.cardId)!, fullNumber: null }
  }

  const fullNumber = generateCardNumber()
  const at = new Date().toISOString()
  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(6, "0")}`,
    merchantId: values.merchantId,
    nickname: values.nickname,
    last4: fullNumber.slice(-4),
    numberRef: `cardnum_${Math.random().toString(16).slice(2, 14)}`,
    spendLimit: values.spendLimit,
    // Nothing in this console captures against a card, so spend starts at zero
    // and stays there rather than being invented for the sake of the bar.
    spent: 0,
    currency: values.currency,
    status: "active",
    categoryLock: values.categoryLock,
    createdAt: at,
  }

  store.cards.push(card)
  store.cardEvents.push({ cardId: card.id, from: null, to: "active", at })
  if (idempotencyKey) {
    store.cardKeys.push({ key: idempotencyKey, fingerprint, cardId: card.id })
  }

  return { card, fullNumber }
}

/**
 * The state machine, guarded on the server. The UI hides the buttons it should
 * not offer, but this is the thing that actually refuses.
 */
export function applyAction(
  id: string,
  action: CardAction,
): { card: Card } | Rejection {
  const card = cardById(id)
  if (!card) return { status: 404, message: "No card with that id." }

  const to = CARD_ACTIONS[action]
  if (!canTransition(card.status, to)) {
    return {
      status: 409,
      message:
        card.status === "cancelled"
          ? "This card is cancelled, and a cancelled card is terminal."
          : `This card is already ${card.status}.`,
    }
  }

  store.cardEvents.push({
    cardId: card.id,
    from: card.status,
    to,
    at: new Date().toISOString(),
  })
  card.status = to
  return { card }
}
