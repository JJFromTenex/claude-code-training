import { CardStatus } from "./types"

/**
 * Status is a state machine: active ⇄ frozen, either to cancelled, and
 * cancelled is terminal. Guarded here so it can't drift between the route
 * and anything else that ever needs to check a transition.
 */
const CARD_STATUS_TRANSITIONS: Record<CardStatus, CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransitionCardStatus(from: CardStatus, to: CardStatus): boolean {
  return CARD_STATUS_TRANSITIONS[from].includes(to)
}
