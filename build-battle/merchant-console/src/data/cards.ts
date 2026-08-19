import { canTransition, generateCardNumber } from "@/lib/cards"
import { merchantById } from "./merchants"
import { store } from "./store"
import { Card, CardStatus, IssueCardInput } from "./types"

/**
 * Card access against the in-memory store.
 *
 * The one rule that shapes this file: the full number exists in exactly one
 * return value, `issueCard().number`. The `Card` record never carries it, so
 * nothing that reads the store can leak it by accident.
 */

let counter = 0

function nextId(): string {
  counter += 1
  return `card_${String(counter).padStart(4, "0")}`
}

/** Issue a card. Returns the public record plus the number, once. */
export function issueCard(input: IssueCardInput, now = new Date()): { card: Card; number: string } {
  const number = generateCardNumber()
  const card: Card = {
    id: nextId(),
    merchantId: input.merchantId,
    nickname: input.nickname,
    limit: input.limit,
    // There are no card transactions in this console yet, so spend is a
    // deterministic slice of the limit that makes the detail page honest
    // without inventing a ledger. Called out in the PR.
    spent: Math.floor(input.limit * ((counter * 37) % 100) / 100),
    currency: input.currency,
    status: "active",
    category: input.category,
    last4: number.slice(-4),
    numberRef: `ref_${number.slice(-4)}_${now.getTime().toString(36)}`,
    createdAt: now.toISOString(),
  }
  store.cards.unshift(card)
  return { card, number }
}

export function listCards(): Card[] {
  return store.cards
}

export function getCard(id: string): Card | undefined {
  return store.cards.find((c) => c.id === id)
}

export type TransitionResult =
  | { ok: true; card: Card }
  | { ok: false; status: 404 | 409; error: string }

/** Guarded status change. The UI reflects this; it does not decide it. */
export function transitionCard(id: string, to: CardStatus): TransitionResult {
  const card = getCard(id)
  if (!card) return { ok: false, status: 404, error: "Card not found." }
  if (!canTransition(card.status, to)) {
    return {
      ok: false,
      status: 409,
      error:
        card.status === "cancelled"
          ? "A cancelled card cannot be changed."
          : `A ${card.status} card cannot move to ${to}.`,
    }
  }
  card.status = to
  return { ok: true, card }
}

/** Convenience for pages: the merchant name beside the card. */
export function merchantNameFor(card: Card): string {
  return merchantById(card.merchantId)?.name ?? card.merchantId
}
