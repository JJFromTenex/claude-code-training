export type Currency = "USD" | "EUR" | "GBP"

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

/** Merchant category a virtual card is locked to at issue time. */
export type CardCategory =
  "general" | "advertising" | "software" | "contractors" | "travel"

export interface CardStatusChange {
  status: CardStatus
  /** ISO 8601, always UTC. */
  at: string
}

/**
 * A virtual card. Never carries the card number: the full number exists in
 * the creation response only. The record keeps the last four and an opaque
 * reference to the generated number.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  category: CardCategory
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units spent against the limit so far. */
  spent: number
  currency: Currency
  status: CardStatus
  last4: string
  reference: string
  /** ISO 8601, always UTC. */
  createdAt: string
  /** Every status the card has held, oldest first. */
  history: CardStatusChange[]
}
