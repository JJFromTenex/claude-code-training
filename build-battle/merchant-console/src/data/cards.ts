import { canTransition } from "@/lib/cards"
import { store } from "./store"
import { Card, CardStatus } from "./types"

/**
 * The only store access for cards. Records never carry the full number, so
 * nothing read from here can leak one.
 */

const pad = (n: number, width = 6) => String(n).padStart(width, "0")

export function listCards(): Card[] {
  return [...store.cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cardById(id: string): Card | null {
  return store.cards.find((c) => c.id === id) ?? null
}

export function insertCard(
  fields: Omit<Card, "id" | "status" | "spent" | "createdAt" | "updatedAt">,
  now: Date = new Date(),
): Card {
  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    ...fields,
    spent: 0,
    status: "active",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  store.cards.push(card)
  return card
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; reason: "not_found" | "illegal_transition"; message: string }

export function transitionCard(
  id: string,
  to: CardStatus,
  now: Date = new Date(),
): TransitionResult {
  const card = cardById(id)
  if (!card) return { ok: false, reason: "not_found", message: "Card not found." }
  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      reason: "illegal_transition",
      message:
        card.status === "cancelled"
          ? "A cancelled card cannot be changed."
          : `A ${card.status} card cannot move to ${to}.`,
    }
  }
  card.status = to
  card.updatedAt = now.toISOString()
  return { ok: true, card }
}
