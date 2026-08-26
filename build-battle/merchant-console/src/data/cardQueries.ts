import { generateCardNumber } from "@/lib/cardNumber"
import { merchantById } from "./merchants"
import { paginate } from "./queries"
import { store } from "./store"
import { Card, CardCategory, CardFilters, CardStatus, Currency } from "./types"

/**
 * Cards are the first resource in this store issued at request time rather
 * than seeded at boot, so they get their own id scheme — generate.ts's
 * counters are module-private and not seeded data to begin with.
 *
 * The next id is derived from store.cards itself rather than a module-level
 * counter: a plain `let` counter gets reset by Next's dev-mode module
 * reloads independently of store.cards (which persists via globalThis),
 * producing duplicate ids after any hot reload. Deriving from the store
 * keeps this correct regardless of module lifecycle.
 */
const pad = (n: number, width = 6) => String(n).padStart(width, "0")

function nextCardId(): string {
  // store.cards is append-only and never reordered (status updates mutate a
  // card in place), so the highest sequence number is always the last one.
  const last = store.cards[store.cards.length - 1]
  const lastSeq = last ? Number(last.id.slice("card_".length)) : 0
  const seq = Number.isFinite(lastSeq) ? lastSeq : 0
  return `card_${pad(seq + 1)}`
}

const CURRENCIES: readonly Currency[] = ["USD", "EUR", "GBP"]
const CATEGORIES: readonly CardCategory[] = [
  "subscriptions",
  "advertising",
  "contractor_tools",
  "other",
]
const MAX_LIMIT = 5_000_000

export interface IssueCardInput {
  nickname: string
  merchantId: string
  limit: number
  currency: Currency
  category?: CardCategory
}

export type ParseIssueCardResult =
  | { ok: true; value: IssueCardInput }
  | { ok: false; fields: Record<string, string> }

/**
 * The server-side allowlist for issuing a card. Anything from the client is
 * checked here before it reaches the store — the client is not trusted.
 */
export function parseIssueCardInput(body: unknown): ParseIssueCardResult {
  const fields: Record<string, string> = {}
  const input = (body ?? {}) as Record<string, unknown>

  const nickname = typeof input.nickname === "string" ? input.nickname.trim() : ""
  if (!nickname) fields.nickname = "Nickname is required."

  const merchantId = typeof input.merchantId === "string" ? input.merchantId : ""
  if (!merchantId || !merchantById(merchantId)) {
    fields.merchantId = "Choose a valid merchant."
  }

  const limit = typeof input.limit === "number" ? input.limit : NaN
  if (!Number.isInteger(limit) || limit <= 0) {
    fields.limit = "Limit must be a positive amount."
  } else if (limit > MAX_LIMIT) {
    fields.limit = `Limit cannot exceed ${MAX_LIMIT.toLocaleString()} minor units.`
  }

  const currency = input.currency as Currency
  if (!CURRENCIES.includes(currency)) {
    fields.currency = "Currency must be USD, EUR, or GBP."
  }

  const category = input.category as CardCategory | undefined
  if (category !== undefined && !CATEGORIES.includes(category)) {
    fields.category = "Not a valid category."
  }

  if (Object.keys(fields).length > 0) {
    return { ok: false, fields }
  }

  return {
    ok: true,
    value: { nickname, merchantId, limit, currency, category },
  }
}

/**
 * Generates the number, stores only its last four, and returns the full
 * number once. Nothing downstream of this function ever sees it again.
 */
export function createCard(input: IssueCardInput): { card: Card; number: string } {
  const number = generateCardNumber()
  const last4 = number.slice(-4)

  const card: Card = {
    id: nextCardId(),
    nickname: input.nickname,
    merchantId: input.merchantId,
    last4,
    limit: input.limit,
    currency: input.currency,
    status: "active",
    category: input.category,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, number }
}

const STATUSES: readonly (CardStatus | "all")[] = ["all", "active", "frozen", "cancelled"]

export function parseCardFilters(params: URLSearchParams): CardFilters {
  const status = params.get("status")
  const page = Number(params.get("page") ?? "1")

  return {
    status: STATUSES.includes(status as CardStatus) ? (status as CardStatus) : "all",
    page: Number.isFinite(page) && page > 0 ? page : 1,
  }
}

export function filterCards(filters: CardFilters): Card[] {
  const { status } = filters
  return store.cards.filter((card) => {
    if (status && status !== "all" && card.status !== status) return false
    return true
  })
}

export function sortCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function queryCards(filters: CardFilters) {
  const filtered = filterCards(filters)
  const sorted = sortCards(filtered)
  return paginate(sorted, filters.page, filters.pageSize)
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export type UpdateStatusResult =
  | { ok: true; card: Card }
  | { ok: false; error: string }

/** Guards the card status state machine server-side. cancelled is terminal. */
export function updateCardStatus(id: string, next: CardStatus): UpdateStatusResult {
  const card = cardById(id)
  if (!card) return { ok: false, error: "Card not found." }

  if (!TRANSITIONS[card.status].includes(next)) {
    return {
      ok: false,
      error: `Cannot move a ${card.status} card to ${next}.`,
    }
  }

  card.status = next
  return { ok: true, card }
}
