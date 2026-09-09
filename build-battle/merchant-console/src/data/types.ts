/** The allowlist and the type are one thing, so a route cannot drift from it. */
export const CURRENCIES = ["USD", "EUR", "GBP"] as const

export type Currency = (typeof CURRENCIES)[number]

export type PaymentStatus =
  "authorized" | "captured" | "refunded" | "failed" | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

export interface Merchant {
  id: string
  name: string
  country: string
  /** IANA timezone. Display converts to this; storage never does. */
  timezone: string
  currency: Currency
  riskTier: "low" | "standard" | "elevated"
}

export interface Payment {
  id: string
  merchantId: string
  /** Integer minor units. Never a float. */
  amount: number
  currency: Currency
  status: PaymentStatus
  method: "card" | "wallet" | "bank_transfer"
  cardBrand: "visa" | "mastercard" | "amex" | null
  last4: string | null
  /** ISO 8601, always UTC. */
  createdAt: string
  description: string
}

export interface Refund {
  id: string
  paymentId: string
  amount: number
  currency: Currency
  reason: "requested_by_customer" | "duplicate" | "fraudulent"
  createdAt: string
}

export interface Dispute {
  id: string
  paymentId: string
  merchantId: string
  amount: number
  currency: Currency
  reasonCode: string
  status: DisputeStatus
  openedAt: string
  /** Evidence deadline, UTC. */
  evidenceDueAt: string
}

export interface Payout {
  id: string
  merchantId: string
  periodStart: string
  periodEnd: string
  gross: number
  fees: number
  net: number
  currency: Currency
  status: PayoutStatus
  paymentIds: string[]
}

export interface PaymentFilters {
  status?: PaymentStatus | "all"
  merchantId?: string
  search?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
  sort?: "createdAt" | "amount"
  direction?: "asc" | "desc"
}

export type CardStatus = "active" | "frozen" | "cancelled"

/**
 * Merchants carry no category of their own, so the lock is a card field with
 * its own allowlist. A card with no lock stores `null`.
 */
export const CARD_CATEGORIES = [
  "advertising",
  "software",
  "travel",
  "office",
  "subscriptions",
] as const

export type CardCategory = (typeof CARD_CATEGORIES)[number]

export interface Card {
  id: string
  merchantId: string
  nickname: string
  /** Last four of the generated number. The full number is never stored. */
  last4: string
  /** An opaque handle for the generated number. Not the number. */
  numberRef: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units. Never a float. */
  spent: number
  currency: Currency
  status: CardStatus
  categoryLock: CardCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
}

/** One entry in a card's append-only status history. */
export interface CardEvent {
  cardId: string
  /** null on the issuing event, which has no previous status. */
  from: CardStatus | null
  to: CardStatus
  /** ISO 8601, always UTC. */
  at: string
}

/** A honoured idempotency key, with a fingerprint of the request that used it. */
export interface CardIdempotencyKey {
  key: string
  fingerprint: string
  cardId: string
}
