import { canTransition, generateCardNumber, lastFour } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits, sumMinorUnits } from "@/lib/money"
import { countsTowardSpend } from "./cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency } from "./types"

/**
 * Card reads and writes against the in-memory store.
 *
 * Kept out of `queries.ts`, which is the payment query builder and stays that
 * way. Nothing here touches payment filtering.
 */

export interface CardWithSpend extends Card {
  /** Integer minor units, in the card's own currency. Derived, never stored. */
  spend: number
}

/** Newest first, matching how the payments table is ordered. */
export function allCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((card) => card.id === id) ?? null
}

/**
 * What a card has consumed of its limit.
 *
 * Summed from the payments linked to it rather than tracked on the record, so
 * every figure on screen can be traced back to the payments that produced it.
 * A card is single-merchant, so every payment on it shares one currency and
 * the sum is meaningful.
 */
export function spendForCard(cardId: string): number {
  return sumMinorUnits(
    store.payments
      .filter((payment) => payment.cardId === cardId && countsTowardSpend(payment))
      .map((payment) => payment.amount),
  )
}

export function withSpend(card: Card): CardWithSpend {
  return { ...card, spend: spendForCard(card.id) }
}

export function paymentsForCard(cardId: string) {
  return store.payments
    .filter((payment) => payment.cardId === cardId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

const pad = (n: number, width = 4) => String(n).padStart(width, "0")

export interface IssueCardInput {
  nickname: string
  merchantId: string
  /** Integer minor units. Converted at the route boundary, never here. */
  spendLimit: number
  currency: Currency
}

/**
 * Issue a card. The only function in the codebase that holds a full number,
 * and it hands it straight back to the caller rather than storing it — the
 * record keeps the last four and an opaque reference and nothing more.
 */
export function issueCard(input: IssueCardInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const sequence = pad(store.cards.length + 1)

  const card: Card = {
    id: `card_${sequence}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    currency: input.currency,
    last4: lastFour(number),
    numberRef: `cnum_${sequence}`,
    status: "active",
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, number }
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "illegal"; from: CardStatus }

/** Server-side guard on the state machine. The UI is never the enforcement. */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }
  if (!canTransition(card.status, to)) {
    return { ok: false, reason: "illegal", from: card.status }
  }

  card.status = to
  return { ok: true, card }
}

/**
 * Everything below is the allowlist the routes check client input against,
 * kept beside the store writes the way `parseFilters` sits beside the payment
 * query builder in `queries.ts`. Client-side checks are a convenience; this is
 * the enforcement.
 */

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

/** Minor units. A limit above this is refused however it arrives. */
export const MAX_SPEND_LIMIT = 5_000_000
export const MAX_NICKNAME_LENGTH = 60

export interface FieldError {
  message: string
  field?: string
}

type Parsed<T> = { ok: true; value: T } | { ok: false; error: FieldError }

const invalid = (message: string, field?: string): Parsed<never> => ({
  ok: false,
  error: { message, field },
})

/**
 * Spend limits arrive as the string the operator typed ("250.00") and are
 * converted to minor units here, once, at the boundary. A number is accepted
 * too, but only as whole minor units — never a float.
 */
function parseSpendLimit(raw: unknown, currency: Currency): Parsed<number> {
  let minorUnits: number | null = null

  if (typeof raw === "number") {
    if (!Number.isInteger(raw)) {
      return invalid("Enter a spend limit like 250.00.", "spendLimit")
    }
    minorUnits = raw
  } else if (typeof raw === "string") {
    minorUnits = parseAmountToMinorUnits(raw)
  }

  if (minorUnits === null) {
    return invalid("Enter a spend limit like 250.00.", "spendLimit")
  }
  if (minorUnits <= 0) {
    return invalid("A spend limit must be more than zero.", "spendLimit")
  }
  if (minorUnits > MAX_SPEND_LIMIT) {
    return invalid(
      `A spend limit cannot be above ${formatMoney(MAX_SPEND_LIMIT, currency)}.`,
      "spendLimit",
    )
  }

  return { ok: true, value: minorUnits }
}

export function parseIssueCardInput(body: unknown): Parsed<IssueCardInput> {
  if (typeof body !== "object" || body === null) {
    return invalid("Send a card to issue.")
  }
  const input = body as Record<string, unknown>

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return invalid("Give the card a nickname.", "nickname")
  }
  if (nickname.length > MAX_NICKNAME_LENGTH) {
    return invalid(
      `A nickname cannot be longer than ${MAX_NICKNAME_LENGTH} characters.`,
      "nickname",
    )
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  const merchant = merchantId ? merchantById(merchantId) : undefined
  if (!merchant) {
    return invalid("Choose a merchant for this card.", "merchantId")
  }

  const currency = input.currency as Currency
  if (typeof currency !== "string" || !CURRENCIES.includes(currency)) {
    return invalid("Choose USD, EUR, or GBP.", "currency")
  }

  /**
   * Beyond what the ticket asks for. A card's spend is summed from its
   * merchant's payments, so a card denominated differently from its merchant
   * would compare a limit in one currency against spend in another.
   */
  if (currency !== merchant.currency) {
    return invalid(
      `${merchant.name} settles in ${merchant.currency}, so its cards must be issued in ${merchant.currency}.`,
      "currency",
    )
  }

  const limit = parseSpendLimit(input.spendLimit, currency)
  if (!limit.ok) return limit

  return {
    ok: true,
    value: { nickname, merchantId, spendLimit: limit.value, currency },
  }
}

export function parseCardStatus(body: unknown): Parsed<CardStatus> {
  const status = (body as Record<string, unknown> | null)?.status
  if (typeof status !== "string" || !CARD_STATUSES.includes(status as CardStatus)) {
    return invalid("That is not a card status.", "status")
  }
  return { ok: true, value: status as CardStatus }
}
