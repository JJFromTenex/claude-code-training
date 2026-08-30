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

export type CardCategory =
  | "ads"
  | "subscriptions"
  | "contractor_tools"
  | "travel"
  | "office"

export interface CardStatusChange {
  from: CardStatus | null
  to: CardStatus
  /** ISO 8601, always UTC. */
  at: string
}

export interface Card {
  id: string
  merchantId: string
  nickname: string
  /** Only the last four digits are ever stored. */
  last4: string
  /** Opaque reference to the generated number. Not derivable back to the PAN. */
  numberRef: string
  /** Integer minor units. */
  spendLimit: number
  /**
   * Integer minor units. 0 at issue — nothing in the store links payments to
   * cards yet, so it stays 0 honestly.
   */
  spent: number
  currency: Currency
  category: CardCategory
  status: CardStatus
  /** ISO 8601, always UTC. */
  createdAt: string
  /** Idempotency key from the client. Unique. */
  requestId: string
  /** Audit trail. First entry is always {from: null, to: "active", at: createdAt}. */
  statusHistory: CardStatusChange[]
}
