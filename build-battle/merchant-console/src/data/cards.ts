import { generateCardNumber, lastFour } from "@/lib/cards"
import { sumMinorUnits } from "@/lib/money"
import {
  CURRENCIES,
  MAX_SPEND_LIMIT,
  MERCHANT_CATEGORIES,
} from "./card-catalog"
import { canTransition, eventTypeFor, isCardStatus, transitionError } from "./card-status"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CardAuthorization,
  CardEvent,
  Currency,
  MerchantCategory,
} from "./types"

/**
 * The card reader and writer, playing the role `queries.ts` plays for
 * payments. Everything a client can send is checked here against an allowlist
 * before it reaches the store; route handlers call in rather than validating
 * for themselves (`.claude/rules/api-routes.md`).
 *
 * The full card number never becomes a field on a `Card`. It exists only as
 * the `number` on an `IssuedCard`, returned once by `issueCard`.
 */

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: MerchantCategory
}

export interface ValidationError {
  field: string
  message: string
}

/** The one response that carries a full number, and only on a fresh issue. */
export interface IssuedCard {
  card: Card
  /** The full PAN. Returned once, never stored, never re-readable. */
  number: string
}

const pad = (n: number, width = 4) => String(n).padStart(width, "0")

function nextId(prefix: string, count: number, width = 4): string {
  return `${prefix}_${pad(count + 1, width)}`
}

/**
 * Validates raw client input into an `IssueCardInput`, or explains why not.
 *
 * Rejects early and returns rather than nesting, so a case cannot go missing:
 * a missing merchant, a zero or negative limit, a limit above the ceiling, a
 * currency outside the allowlist, and a currency the merchant does not settle
 * in.
 */
export function validateIssueInput(
  raw: unknown,
): { ok: true; input: IssueCardInput } | { ok: false; errors: ValidationError[] } {
  const errors: ValidationError[] = []

  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      errors: [{ field: "body", message: "Expected a JSON object." }],
    }
  }

  const body = raw as Record<string, unknown>

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (nickname.length === 0) {
    errors.push({ field: "nickname", message: "Give the card a nickname." })
  } else if (nickname.length > 60) {
    errors.push({
      field: "nickname",
      message: "Nicknames are 60 characters or fewer.",
    })
  }

  const merchantId = typeof body.merchantId === "string" ? body.merchantId : ""
  const merchant = merchantId ? merchantById(merchantId) : undefined
  if (!merchant) {
    errors.push({
      field: "merchantId",
      message: merchantId
        ? "That merchant does not exist."
        : "Choose the merchant this card belongs to.",
    })
  }

  // Minor units only. A float or a string with a symbol is client input that
  // was never converted at the boundary, so it is refused rather than coerced.
  const spendLimit = body.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    errors.push({
      field: "spendLimit",
      message: "The spend limit must be a whole number of minor units.",
    })
  } else if (spendLimit <= 0) {
    errors.push({
      field: "spendLimit",
      message: "The spend limit must be greater than zero.",
    })
  } else if (spendLimit > MAX_SPEND_LIMIT) {
    errors.push({
      field: "spendLimit",
      message: `The spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`,
    })
  }

  // A card is single-merchant, so it settles in the merchant's currency.
  // Omitting the field means "the merchant's", which is always right.
  const currency = body.currency === undefined ? merchant?.currency : body.currency
  if (!CURRENCIES.includes(currency as Currency)) {
    errors.push({
      field: "currency",
      message: `Currency must be one of ${CURRENCIES.join(", ")}.`,
    })
  } else if (merchant && currency !== merchant.currency) {
    errors.push({
      field: "currency",
      message: `${merchant.name} settles in ${merchant.currency}, so this card must be ${merchant.currency}.`,
    })
  }

  const categoryLock = body.categoryLock === undefined ? "any" : body.categoryLock
  if (!MERCHANT_CATEGORIES.includes(categoryLock as MerchantCategory)) {
    errors.push({
      field: "categoryLock",
      message: "Choose a category lock from the list.",
    })
  }

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    input: {
      nickname,
      merchantId,
      spendLimit: spendLimit as number,
      currency: currency as Currency,
      categoryLock: categoryLock as MerchantCategory,
    },
  }
}

/**
 * Issues a card and returns the full number exactly once.
 *
 * `idempotencyKey` makes a retried or double-clicked issue safe: the same key
 * returns the card already created for it, and `issueCard` is not called again.
 */
export function issueCard(
  input: IssueCardInput,
  now: Date = new Date(),
): IssuedCard {
  const number = generateCardNumber()
  const card: Card = {
    id: nextId("card", store.cards.length),
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    last4: lastFour(number),
    reference: `cref_${pad(store.cards.length + 1, 8)}`,
    createdAt: now.toISOString(),
  }

  store.cards.push(card)
  recordEvent(
    card.id,
    "issued",
    `Issued to ${merchantById(card.merchantId)?.name ?? card.merchantId}`,
    now,
  )

  return { card, number }
}

/** The card a previous request with this key created, if there was one. */
export function issuedForKey(idempotencyKey: string): Card | null {
  const id = store.issuedByKey.get(idempotencyKey)
  return id ? cardById(id) : null
}

export function rememberIdempotencyKey(idempotencyKey: string, cardId: string) {
  store.issuedByKey.set(idempotencyKey, cardId)
}

/**
 * Moves a card's status, refusing anything the state machine does not allow.
 * This is the enforcement; the UI's disabled buttons are only a convenience.
 */
export function setCardStatus(
  cardId: string,
  next: unknown,
  now: Date = new Date(),
): { ok: true; card: Card } | { ok: false; status: number; message: string } {
  const card = cardById(cardId)
  if (!card) {
    return { ok: false, status: 404, message: "No card with that id." }
  }

  if (!isCardStatus(next)) {
    return {
      ok: false,
      status: 422,
      message: "Status must be one of active, frozen, cancelled.",
    }
  }

  if (!canTransition(card.status, next)) {
    return { ok: false, status: 409, message: transitionError(card.status, next) }
  }

  const eventType = eventTypeFor(card.status, next)!
  const from = card.status
  card.status = next
  recordEvent(card.id, eventType, `Status moved from ${from} to ${next}`, now)

  return { ok: true, card }
}

function recordEvent(
  cardId: string,
  type: CardEvent["type"],
  detail: string,
  now: Date,
): CardEvent {
  const event: CardEvent = {
    id: nextId("cev", store.cardEvents.length),
    cardId,
    type,
    at: now.toISOString(),
    detail,
  }
  store.cardEvents.push(event)
  return event
}

/** Every card, newest first. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

export function authorizationsForCard(cardId: string): CardAuthorization[] {
  return store.cardAuthorizations
    .filter((auth) => auth.cardId === cardId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function eventsForCard(cardId: string): CardEvent[] {
  return store.cardEvents
    .filter((event) => event.cardId === cardId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

/**
 * What has actually been authorised against a card, in minor units.
 * A card with no authorisations has spent nothing, and says so.
 */
export function cardSpend(cardId: string): number {
  return sumMinorUnits(authorizationsForCard(cardId).map((auth) => auth.amount))
}
