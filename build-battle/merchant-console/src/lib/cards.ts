import { CardStatus } from "@/data/types"

const TRANSITIONS: Record<CardStatus, Set<CardStatus>> = {
  active: new Set(["frozen", "cancelled"]),
  frozen: new Set(["active", "cancelled"]),
  cancelled: new Set(),
}

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].has(to)
}

export function maskCardNumber(last4: string): string {
  return `•••• ${last4}`
}
