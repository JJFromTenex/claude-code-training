export type Currency = "USD" | "EUR" | "GBP"

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

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

export type MerchantCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "utilities"

/**
 * A virtual card issued from the console.
 *
 * The full number is never here. It exists in the creation response and
 * nowhere else; the record carries the last four and an issuer reference.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units, in the same currency as the limit. */
  spent: number
  currency: Currency
  status: CardStatus
  category: MerchantCategory | null
  brand: "visa"
  /** Last four digits only. */
  last4: string
  /** Issuer reference for the generated number. Not the number. */
  reference: string
  /** ISO 8601, always UTC. */
  createdAt: string
}

/** A validated issue request. Everything here has already passed the allowlist. */
export interface CardInput {
  nickname: string
  merchantId: string
  /** Integer minor units, already converted from client input. */
  spendLimit: number
  currency: Currency
  category: MerchantCategory | null
}

/**
 * One entry in a card's history. Ops asks "what happened to this card last
 * Tuesday" and this is what answers it, so every status change appends one.
 */
export interface CardEvent {
  id: string
  cardId: string
  /** null when the card was issued; otherwise the status it moved from. */
  from: CardStatus | null
  to: CardStatus
  /** ISO 8601, always UTC. */
  at: string
}
