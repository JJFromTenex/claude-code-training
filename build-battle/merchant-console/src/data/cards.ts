import { MAX_SPEND_LIMIT, canTransition, generateCardNumber } from "@/lib/cards"
import { formatMoney, parseAmountToMinorUnits } from "@/lib/money"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, Currency, MerchantCategory } from "./types"

/** The single card path — the role `queries.ts` plays for payments. */

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
  { ok: true; value: T } | { ok: false; message: string }

/** Allowlist everything from the client; the form's checks are convenience. */
export function parseCardInput(body: unknown): ParseResult<CardIssueInput> {
  if (typeof body !== "object" || body === null)
    return bad("Expected a JSON object.")
  const input = body as Record<string, unknown>

  const nickname = str(input.nickname).trim()
  if (!nickname) return bad("Give the card a nickname.")
  if (nickname.length > NICKNAME_MAX)
    return bad(`Nickname must be ${NICKNAME_MAX} characters or fewer.`)

  const merchantId = str(input.merchantId)
  if (!merchantId) return bad("Choose a merchant.")
  const merchant = merchantById(merchantId)
  if (!merchant) return bad("That merchant does not exist.")

  const currency = input.currency as Currency
  if (!CURRENCIES.includes(currency))
    return bad(`Currency must be one of ${CURRENCIES.join(", ")}.`)
  // A card settles where its merchant settles: a limit and a spend in two
  // currencies makes every comparison between them meaningless.
  if (currency !== merchant.currency)
    return bad(
      `${merchant.name} settles in ${merchant.currency}, so its cards cannot be issued in ${currency}.`,
    )

  const spendLimit = toMinorUnits(input.spendLimit)
  if (spendLimit === null)
    return bad("Spend limit must be a whole minor-unit amount.")
  if (spendLimit <= 0) return bad("Spend limit must be greater than zero.")
  // Ops reads this, so it says $50,000.00 rather than 5000000.
  if (spendLimit > MAX_SPEND_LIMIT)
    return bad(
      `Spend limit cannot exceed ${formatMoney(MAX_SPEND_LIMIT, currency)}.`,
    )

  const category = (input.category ?? null) as MerchantCategory | null
  if (category !== null && !CATEGORIES.includes(category))
    return bad("That category is not one we lock cards to.")

  return {
    ok: true,
    value: { nickname, merchantId, spendLimit, currency, category },
  }
}

const bad = (message: string) => ({ ok: false as const, message })
const str = (v: unknown) => (typeof v === "string" ? v : "")

/** Minor units already, or text a human typed. Converts here and nowhere else. */
function toMinorUnits(value: unknown): number | null {
  if (typeof value === "number")
    return Number.isSafeInteger(value) ? value : null
  return typeof value === "string" ? parseAmountToMinorUnits(value) : null
}

export const listCards = (): Card[] =>
  [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

export const cardById = (id: string): Card | undefined =>
  store.cards.find((card) => card.id === id)

export interface IssueResult {
  card: Card
  /** `null` on a replay: reveal-once outranks a byte-identical response. */
  cardNumber: string | null
  replayed: boolean
}

/** What the request asked for, so two cards cannot hide behind one key. */
const fingerprint = (i: CardIssueInput) =>
  JSON.stringify([
    i.nickname,
    i.merchantId,
    i.spendLimit,
    i.currency,
    i.category,
  ])

/**
 * Returns the full number beside the card. It is never stored, so this is the
 * only moment it exists. An `idempotencyKey` makes a retry safe — a guard the
 * disabled button cannot give, living in a tab that may be gone. A key reused
 * for a *different* card is a client bug and is refused: answering with the
 * first card would tell ops they hold one they do not.
 */
export function issueCard(
  input: CardIssueInput,
  idempotencyKey?: string,
): ParseResult<IssueResult> {
  const seen = idempotencyKey
    ? store.cardIdempotency[idempotencyKey]
    : undefined
  const existing = seen && cardById(seen.cardId)
  if (seen && existing) {
    return seen.fingerprint === fingerprint(input)
      ? {
          ok: true,
          value: { card: existing, cardNumber: null, replayed: true },
        }
      : bad(
          "That idempotency key was already used to issue a different card. Use a new key.",
        )
  }

  const cardNumber = generateCardNumber()
  const seq = String(store.cards.length + 1).padStart(4, "0")
  // A real write, so a real instant, in UTC. Only seed data uses GENERATED_AT.
  const at = new Date().toISOString()

  const card: Card = {
    id: `card_${seq}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    spendLimit: input.spendLimit,
    currency: input.currency,
    status: "active",
    last4: cardNumber.slice(-4),
    reference: `cref_${seq}`,
    category: input.category,
    spend: 0,
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

/** The state-machine guard lives here, so a stale tab cannot revive a card. */
export function transitionCard(id: string, to: CardStatus): ParseResult<Card> {
  const card = cardById(id)
  if (!card) return bad("That card does not exist.")
  if (!canTransition(card.status, to))
    return bad(
      card.status === "cancelled"
        ? "A cancelled card is cancelled for good."
        : `A ${card.status} card cannot become ${to}.`,
    )

  card.status = to
  return { ok: true, value: card }
}

/** Spend against the limit as a whole percentage, clamped for display. */
export const spendPercent = (c: Card) =>
  c.spendLimit <= 0
    ? 0
    : Math.min(100, Math.round((c.spend / c.spendLimit) * 100))
