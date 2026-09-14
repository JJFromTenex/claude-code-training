import { CardCategory, CardStatus } from "@/data/types"

/** Client-safe card rules: masking, categories, and the status state machine. Generation lives in data/card-number.ts. */

/** Highest spend limit a card can be issued with, in integer minor units. */
export const MAX_SPEND_LIMIT = 5_000_000

export const CARD_CATEGORIES: readonly CardCategory[] = ["any", "advertising", "software", "travel", "office_supplies", "contractors"]

export const CARD_CATEGORY_LABELS: Record<CardCategory, string> = {
  any: "Any merchant",
  advertising: "Advertising",
  software: "Software",
  travel: "Travel",
  office_supplies: "Office supplies",
  contractors: "Contractors",
}

/** The only way a card number is ever shown after creation. */
export const maskCardNumber = (last4: string) => `•••• ${last4}`

/** Legal next states. `cancelled` has none: it is terminal. */
export const CARD_TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  active: ["frozen", "cancelled"],
  frozen: ["active", "cancelled"],
  cancelled: [],
}

export const canTransition = (from: CardStatus, to: CardStatus) => CARD_TRANSITIONS[from].includes(to)
