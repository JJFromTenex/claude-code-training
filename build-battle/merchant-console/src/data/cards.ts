import {
  CARD_CATEGORY_OPTIONS,
  CARD_CURRENCY_OPTIONS,
} from "@/lib/card-display"
import { canTransition, generateCardNumber, lastFour } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import {
  Card,
  CardEventKind,
  CardStatus,
  Currency,
  MerchantCategory,
} from "./types"

/**
 * The one card query builder. Every card list, lookup, issue, and status
 * change goes through it. A second implementation is a defect, not a shortcut.
 *
 * Everything that arrives from a client is checked against an allowlist here
 * before it reaches the store — route handlers call this rather than trusting
 * their own parsing.
 */

// Derived from the display options so the validator and the form can never
// disagree about what a valid currency or category is.
const CARD_CURRENCIES: readonly Currency[] = CARD_CURRENCY_OPTIONS

const CARD_CATEGORIES: readonly MerchantCategory[] =
  CARD_CATEGORY_OPTIONS.map((option) => option.value)

const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

/** Minor units. A limit above this is rejected. */
export const MAX_SPEND_LIMIT = 5_000_000
export const MAX_NICKNAME_LENGTH = 60

export interface IssueCardInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string }

/**
 * Validates untrusted issue input. Rejects early and returns a message that is
 * safe to show a user, matching the error shape the other routes use.
 */
export function parseIssueCardInput(input: unknown): ParseResult<IssueCardInput> {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Expected a JSON object." }
  }
  const body = input as Record<string, unknown>

  const nickname = typeof body.nickname === "string" ? body.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, error: "Nickname is required." }
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return {
      ok: false,
      error: `Nickname must be ${MAX_NICKNAME_LENGTH} characters or fewer.`,
    }
  }

  const merchantId =
    typeof body.merchantId === "string" ? body.merchantId.trim() : ""
  if (!merchantId) {
    return { ok: false, error: "Merchant is required." }
  }
  const merchant = merchantById(merchantId)
  if (!merchant) {
    return { ok: false, error: "Unknown merchant." }
  }

  const spendLimit = body.spendLimit
  if (typeof spendLimit !== "number" || !Number.isInteger(spendLimit)) {
    return {
      ok: false,
      error: "Spend limit must be a whole number of minor units.",
    }
  }
  if (spendLimit <= 0) {
    return { ok: false, error: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      error: `Spend limit must be ${MAX_SPEND_LIMIT} minor units or less.`,
    }
  }

  const currency = body.currency
  if (!CARD_CURRENCIES.includes(currency as Currency)) {
    return {
      ok: false,
      error: `Currency must be one of ${CARD_CURRENCIES.join(", ")}.`,
    }
  }
  // A card settles against its merchant, and the merchant has exactly one
  // currency. Issuing in another one produces a card that cannot be
  // reconciled — the mistake that put the wrong limit on a card last month.
  if (currency !== merchant.currency) {
    return {
      ok: false,
      error: `${merchant.name} settles in ${merchant.currency}. Issue this card in ${merchant.currency}.`,
    }
  }

  // Optional: absent means no lock.
  const rawCategory = body.category ?? "any"
  if (!CARD_CATEGORIES.includes(rawCategory as MerchantCategory)) {
    return {
      ok: false,
      error: `Category must be one of ${CARD_CATEGORIES.join(", ")}.`,
    }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit,
      currency: currency as Currency,
      category: rawCategory as MerchantCategory,
    },
  }
}

export function parseCardStatus(value: unknown): ParseResult<CardStatus> {
  if (!CARD_STATUSES.includes(value as CardStatus)) {
    return {
      ok: false,
      error: `Status must be one of ${CARD_STATUSES.join(", ")}.`,
    }
  }
  return { ok: true, value: value as CardStatus }
}

function nextCardId(): string {
  return `card_${String(store.cards.length + 1).padStart(6, "0")}`
}

/**
 * Issues a card and returns the stored record alongside the full number.
 *
 * The number is returned exactly once, here. It is deliberately not part of
 * `Card`, so there is nowhere to read it back from.
 */
/**
 * Issue keys already honoured, mapped to the card they produced.
 *
 * Disabling the submit button stops the common double-click; it does nothing
 * about a retry, a refresh, or a second tab, each of which would otherwise
 * mint a second card against the same merchant. The key is minted per form,
 * so a replay returns the original card instead of issuing another.
 *
 * Held on the store so it shares the in-memory lifetime of everything else.
 */
export function issuedCardForKey(key: string): Card | null {
  const cardId = store.issueKeys.get(key)
  return cardId ? cardById(cardId) : null
}

export function rememberIssueKey(key: string, cardId: string): void {
  store.issueKeys.set(key, cardId)
}

export function issueCard(input: IssueCardInput): {
  card: Card
  number: string
} {
  const number = generateCardNumber()
  const issuedAt = new Date().toISOString()
  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4: lastFour(number),
    // Random, never derived from the number: a hash of the PAN stored on the
    // record would narrow the search space back down to it.
    reference: `cref_${randomReference()}`,
    spendLimit: input.spendLimit,
    spend: 0,
    currency: input.currency,
    status: "active",
    category: input.category,
    createdAt: issuedAt,
    history: [{ kind: "issued", at: issuedAt }],
  }
  store.cards.unshift(card)
  return { card, number }
}

/** The event a legal transition records. */
const TRANSITION_EVENT: Record<CardStatus, CardEventKind | null> = {
  frozen: "frozen",
  active: "unfrozen",
  cancelled: "cancelled",
}

/** Handle a card can be referred to by, unrelated to its number. */
function randomReference(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * Applies a status change, guarded by the state machine. The UI hiding a
 * button is a courtesy; this is the enforcement.
 */
export function transitionCard(
  id: string,
  to: CardStatus,
): ParseResult<Card> {
  const card = cardById(id)
  if (!card) return { ok: false, error: "Card not found." }
  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      error:
        card.status === "cancelled"
          ? "A cancelled card cannot change status."
          : `A ${card.status} card cannot become ${to}.`,
    }
  }
  card.status = to
  const kind = TRANSITION_EVENT[to]
  if (kind) card.history.push({ kind, at: new Date().toISOString() })
  return { ok: true, value: card }
}
