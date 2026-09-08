import { canTransition, generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardCategory, CardEvent, CardEventType, CardStatus, Currency } from "./types"

/**
 * Store accessors for cards. The full number never lands in here: createCard
 * hands it back once and keeps only the last four and a reference to it.
 */

export type CardAction = "freeze" | "unfreeze" | "cancel"

const ACTIONS: Record<CardAction, { to: CardStatus; event: CardEventType }> = {
  freeze: { to: "frozen", event: "frozen" },
  unfreeze: { to: "active", event: "unfrozen" },
  cancel: { to: "cancelled", event: "cancelled" },
}

const CARD_PREFIX = "card_"
const EVENT_PREFIX = "cev_"

/** Continues the sequence already in the collection, so ids never collide. */
function nextId(prefix: string, rows: readonly { id: string }[]): string {
  const highest = rows.reduce((max, row) => {
    const n = Number(row.id.slice(prefix.length))
    return Number.isInteger(n) && n > max ? n : max
  }, 0)
  return `${prefix}${String(highest + 1).padStart(6, "0")}`
}

function appendEvent(cardId: string, type: CardEventType, at: string) {
  const id = nextId(EVENT_PREFIX, store.cardEvents)
  store.cardEvents.push({ id, cardId, type, at })
}

/** Newest first, the way ops reads a list of things they just issued. */
export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((card) => card.id === id)
}

/** Oldest first: an audit trail reads forwards. */
export function eventsForCard(cardId: string): CardEvent[] {
  return store.cardEvents
    .filter((event) => event.cardId === cardId)
    .sort((a, b) => a.at.localeCompare(b.at))
}

export function createCard(input: {
  nickname: string
  merchantId: string
  spendLimit: number
  currency: Currency
  categoryLock: CardCategory | null
  idempotencyKey?: string
}):
  | { card: Card; fullNumber: string; replayed: false }
  | { card: Card; replayed: true }
  | { conflict: true } {
  const { idempotencyKey } = input

  // What this key was used for. Same key, same body is a replay; same key, a
  // different body is a caller bug, and handing back the original card would
  // silently return the wrong record.
  const fingerprint = JSON.stringify([
    input.nickname, input.merchantId, input.spendLimit, input.currency, input.categoryLock,
  ])
  if (idempotencyKey) {
    const seen = store.cardIdempotency[idempotencyKey]
    if (seen) {
      if (seen.fingerprint !== fingerprint) return { conflict: true }
      const card = cardById(seen.cardId)
      // A replay answers with the record and no number. The reveal already happened.
      if (card) return { card, replayed: true }
    }
  }

  const fullNumber = generateCardNumber()
  const createdAt = new Date().toISOString()
  const card: Card = {
    id: nextId(CARD_PREFIX, store.cards),
    merchantId: input.merchantId,
    nickname: input.nickname,
    last4: fullNumber.slice(-4),
    // A reference stands in for the number the store never keeps.
    numberRef: `cardnum_${Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16)).join("")}`,
    spendLimit: input.spendLimit,
    spent: 0,
    currency: input.currency,
    status: "active",
    categoryLock: input.categoryLock,
    createdAt,
  }
  store.cards.push(card)
  appendEvent(card.id, "issued", createdAt)
  if (idempotencyKey) {
    store.cardIdempotency[idempotencyKey] = { cardId: card.id, fingerprint }
  }
  return { card, fullNumber, replayed: false }
}

/** The state machine, guarded here rather than in the UI. The reason lets a route pick 404 or 409. */
export function transitionCard(
  id: string,
  action: CardAction,
): { ok: true; card: Card } | { ok: false; reason: "not_found" | "illegal" } {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found" }
  const { to, event } = ACTIONS[action]
  if (!canTransition(card.status, to)) return { ok: false, reason: "illegal" }
  card.status = to
  appendEvent(card.id, event, new Date().toISOString())
  return { ok: true, card }
}
