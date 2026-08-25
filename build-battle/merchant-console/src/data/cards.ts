import { MAX_SPEND_LIMIT, canTransition, generateCardNumber } from "@/lib/cards"
import { parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, MerchantCategory } from "./types"

/**
 * The single card access path. Every read and every write of a card goes
 * through here, the way payment filtering goes through `queries.ts`, so there
 * is one place a card is created and one place client input is checked.
 */

export const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]

export const CATEGORIES: readonly MerchantCategory[] = [
  "advertising",
  "software",
  "travel",
  "contractors",
  "shipping",
]

export const CATEGORY_LABELS: Record<MerchantCategory, string> = {
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  contractors: "Contractors",
  shipping: "Shipping",
}

const NICKNAME_MAX = 60

export interface CardIssueInput {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  category: MerchantCategory | null
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; message: string }

/**
 * Allowlist everything that arrives from the client before it reaches the
 * store. The form's own checks are a convenience; this is the enforcement.
 * Rejects early and returns, so no case gets lost in a nested branch.
 */
export function parseCardInput(body: unknown): ParseResult<CardIssueInput> {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Expected a JSON object." }
  }
  const input = body as Record<string, unknown>

  const nickname =
    typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) {
    return { ok: false, message: "Give the card a nickname." }
  }
  if (nickname.length > NICKNAME_MAX) {
    return {
      ok: false,
      message: `Nickname must be ${NICKNAME_MAX} characters or fewer.`,
    }
  }

  const merchantId =
    typeof input.merchantId === "string" ? input.merchantId : ""
  if (!merchantId) {
    return { ok: false, message: "Choose a merchant." }
  }
  const merchant = merchantById(merchantId)
  if (!merchant) {
    return { ok: false, message: "That merchant does not exist." }
  }

  const currency = input.currency
  if (!CURRENCIES.includes(currency as Currency)) {
    return {
      ok: false,
      message: `Currency must be one of ${CURRENCIES.join(", ")}.`,
    }
  }
  /**
   * A card settles where its merchant settles. Allowing anything else would
   * put a spend limit and a spend in two different currencies on one record,
   * and every comparison between them — the progress bar included — would be
   * meaningless even though the numbers would still add up.
   */
  if (currency !== merchant.currency) {
    return {
      ok: false,
      message: `${merchant.name} settles in ${merchant.currency}, so its cards cannot be issued in ${currency}.`,
    }
  }

  const spendLimit = toMinorUnits(input.spendLimit)
  if (spendLimit === null) {
    return { ok: false, message: "Spend limit must be a whole minor-unit amount." }
  }
  if (spendLimit <= 0) {
    return { ok: false, message: "Spend limit must be greater than zero." }
  }
  if (spendLimit > MAX_SPEND_LIMIT) {
    return {
      ok: false,
      message: `Spend limit cannot exceed ${MAX_SPEND_LIMIT} minor units.`,
    }
  }

  const category = input.category ?? null
  if (category !== null && !CATEGORIES.includes(category as MerchantCategory)) {
    return { ok: false, message: "That category is not one we lock cards to." }
  }

  return {
    ok: true,
    value: {
      nickname,
      merchantId,
      spendLimit,
      currency: currency as Currency,
      category: category as MerchantCategory | null,
    },
  }
}

/**
 * A limit arrives either already in minor units (a number, from the form) or
 * as text a human typed. Text is converted at this boundary and nowhere else.
 */
function toMinorUnits(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? value : null
  }
  if (typeof value === "string") {
    return parseAmountToMinorUnits(value)
  }
  return null
}

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((card) => card.id === id)
}

export interface IssueResult {
  card: Card
  /**
   * The full number, or `null` when this was a replay of an earlier request.
   * Reveal-once outranks returning a byte-identical response: a replay proves
   * the card exists, it does not re-open the one window the number had.
   */
  cardNumber: string | null
  replayed: boolean
}

/**
 * What the request asked for, so a replayed key can be checked against it.
 * Two different cards must never hide behind one key.
 */
function fingerprint(input: CardIssueInput): string {
  return JSON.stringify([
    input.nickname,
    input.merchantId,
    input.spendLimit,
    input.currency,
    input.category,
  ])
}

/**
 * Creates the card and returns the full number alongside it. The number is not
 * on the `Card` and is never stored, so this is the only moment it exists.
 * Callers must put it in the creation response and nowhere else.
 *
 * An `idempotencyKey` makes a retry safe. Ops double-clicking Issue, or a
 * request the network retried, must not put two live cards on one merchant —
 * a guard the disabled button cannot give, because it lives in the tab that
 * may already be gone.
 *
 * A key reused with a *different* card is a client bug, not a retry, and is
 * refused. Returning the first card would tell ops they had issued the
 * £5,000 card they just described when they actually hold an earlier $100 one.
 */
export function issueCard(
  input: CardIssueInput,
  idempotencyKey?: string,
): ParseResult<IssueResult> {
  if (idempotencyKey) {
    const seen = store.cardIdempotency[idempotencyKey]
    const existing = seen ? cardById(seen.cardId) : undefined
    if (seen && existing) {
      if (seen.fingerprint !== fingerprint(input)) {
        return {
          ok: false,
          message:
            "That idempotency key was already used to issue a different card. Use a new key.",
        }
      }
      return {
        ok: true,
        value: { card: existing, cardNumber: null, replayed: true },
      }
    }
  }

  const cardNumber = generateCardNumber()
  const sequence = store.cards.length + 1
  // A real write, so a real instant — in UTC, like every other stored date.
  // Only the seed data anchors to GENERATED_AT.
  const at = new Date().toISOString()

  const card: Card = {
    id: `card_${String(sequence).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    currency: input.currency,
    status: "active",
    last4: cardNumber.slice(-4),
    reference: `cref_${String(sequence).padStart(4, "0")}`,
    category: input.category,
    spend: 0,
    events: [{ from: null, to: "active", at }],
    createdAt: at,
  }

  store.cards.push(card)
  if (idempotencyKey) {
    store.cardIdempotency[idempotencyKey] = {
      cardId: card.id,
      fingerprint: fingerprint(input),
    }
  }
  return { ok: true, value: { card, cardNumber, replayed: false } }
}

/**
 * Moves a card through the state machine. The guard lives here rather than in
 * the UI, so a stale tab cannot revive a cancelled card.
 */
export function transitionCard(
  id: string,
  to: CardStatus,
): ParseResult<Card> {
  const card = cardById(id)
  if (!card) return { ok: false, message: "That card does not exist." }

  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      message:
        card.status === "cancelled"
          ? "A cancelled card is cancelled for good."
          : `A ${card.status} card cannot become ${to}.`,
    }
  }

  card.events.push({ from: card.status, to, at: new Date().toISOString() })
  card.status = to
  return { ok: true, value: card }
}

/** Spend against the limit as a percentage, clamped for display. */
export function spendPercent(card: Card): number {
  if (card.spendLimit <= 0) return 0
  return Math.min(100, Math.round((card.spend / card.spendLimit) * 100))
}
