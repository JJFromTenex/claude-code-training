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

/** The card a previous request with this idempotency key already issued, if any. */
export function cardByIssueKey(key: string): Card | null {
  const id = store.cardIssueKeys[key]
  return id ? cardById(id) : null
}

export function insertCard(
  fields: Omit<Card, "id" | "status" | "spent" | "history" | "createdAt" | "updatedAt">,
  options: { idempotencyKey?: string; now?: Date } = {},
): Card {
  const at = (options.now ?? new Date()).toISOString()
  const card: Card = {
    id: `card_${pad(store.cards.length + 1)}`,
    ...fields,
    spent: 0,
    status: "active",
    history: [{ status: "active", at }],
    createdAt: at,
    updatedAt: at,
  }
  store.cards.push(card)
  if (options.idempotencyKey) store.cardIssueKeys[options.idempotencyKey] = card.id
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
  const at = now.toISOString()
  card.status = to
  card.updatedAt = at
  card.history.push({ status: to, at })
  return { ok: true, card }
}
