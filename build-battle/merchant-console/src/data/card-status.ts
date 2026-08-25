import { CardEventType, CardStatus } from "./types"

/**
 * The card status state machine.
 *
 * `active ⇄ frozen`, either of them to `cancelled`, and `cancelled` is
 * terminal (`.claude/rules/cards.md`). This module is pure and has no access
 * to the store, so the rule can be proven by test rather than by clicking.
 * Route handlers enforce it; the UI only mirrors it.
 */

export const CARD_STATUSES: readonly CardStatus[] = [
  "active",
  "frozen",
  "cancelled",
]

const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** Whether a value off the wire names a status at all. */
export function isCardStatus(value: unknown): value is CardStatus {
  return CARD_STATUSES.includes(value as CardStatus)
}

/** The statuses a card may move to from where it is now. */
export function allowedTransitions(from: CardStatus): readonly CardStatus[] {
  return TRANSITIONS[from]
}

/** Whether a specific move is legal. A no-op move is not a transition. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to)
}

/** True once nothing can follow. */
export function isTerminal(status: CardStatus): boolean {
  return TRANSITIONS[status].length === 0
}

/** The audit event a legal transition records. */
export function eventTypeFor(
  from: CardStatus,
  to: CardStatus,
): CardEventType | null {
  if (!canTransition(from, to)) return null
  if (to === "cancelled") return "cancelled"
  if (to === "frozen") return "frozen"
  return "unfrozen"
}

/** Why a move was refused, in words safe to show an operator. */
export function transitionError(from: CardStatus, to: CardStatus): string {
  if (from === to) return `This card is already ${from}.`
  if (isTerminal(from)) {
    return `A cancelled card cannot be ${to === "active" ? "reactivated" : `set to ${to}`}. Cancellation is permanent.`
  }
  return `A ${from} card cannot move to ${to}.`
}
