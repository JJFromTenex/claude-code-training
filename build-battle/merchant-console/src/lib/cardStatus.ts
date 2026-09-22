import { CardStatus } from "@/data/types"

/**
 * Card status is a state machine: active <-> frozen, either to cancelled,
 * and cancelled is terminal. Guarded here so no caller can special-case it.
 */
const ALLOWED_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}
