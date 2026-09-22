import { CardStatus } from "@/data/types"

/**
 * Card status is a state machine and this table is the whole of it. Active and
 * frozen convert into each other, either one can be cancelled, and cancelled
 * is terminal. The server checks this before any write, so a client that
 * forges an action gets a refusal rather than a resurrected card.
 */

/** The only legal moves. Anything absent from this table is refused. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

/** The action names a client may send. */
export const CARD_ACTIONS = ["freeze", "unfreeze", "cancel"] as const

export type CardAction = (typeof CARD_ACTIONS)[number]

const ACTION_TARGETS: Record<CardAction, CardStatus> = {
  freeze: "frozen",
  unfreeze: "active",
  cancel: "cancelled",
}

/** Whether a client-supplied action name is one we accept. */
export function isCardAction(value: unknown): value is CardAction {
  return (
    typeof value === "string" &&
    (CARD_ACTIONS as readonly string[]).includes(value)
  )
}

/** The status an action moves a card to. */
export function statusForAction(action: CardAction): CardStatus {
  return ACTION_TARGETS[action]
}

/** Whether a card may move between two statuses. Standing still is never legal. */
export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return CARD_TRANSITIONS[from].includes(to)
}
