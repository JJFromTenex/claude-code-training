import { generateCardNumber } from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * Cards, including the app's first writes to the store. Reads, issuance,
 * and status transitions all live here, the way payments' reads live in
 * queries.ts — cards just have no filter/sort/paginate to share with it.
 */

export function listCards(): Card[] {
  return store.cards
}

export function cardById(id: string): Card | undefined {
  return store.cards.find((card) => card.id === id)
}

export function issueCard(input: {
  nickname: string
  merchantId: string
  limitMinorUnits: number
  currency: Card["currency"]
  category: Card["category"]
}): { card: Card; fullNumber: string } {
  const fullNumber = generateCardNumber()
  const last4 = fullNumber.slice(-4)
  const spentMinorUnits = Math.floor(Math.random() * (input.limitMinorUnits + 1))

  const card: Card = {
    id: `card_${String(store.cards.length + 1).padStart(4, "0")}`,
    nickname: input.nickname,
    merchantId: input.merchantId,
    currency: input.currency,
    limitMinorUnits: input.limitMinorUnits,
    spentMinorUnits,
    status: "active",
    category: input.category,
    last4,
    createdAt: new Date().toISOString(),
  }

  store.cards.push(card)
  return { card, fullNumber }
}

const ALLOWED_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function setCardStatus(
  id: string,
  next: CardStatus,
): { card: Card } | { error: string } {
  const card = cardById(id)
  if (!card) return { error: "Card not found." }
  if (!ALLOWED_TRANSITIONS[card.status].includes(next)) {
    return { error: `Cannot move a ${card.status} card to ${next}.` }
  }
  card.status = next
  return { card }
}
