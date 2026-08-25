export type Currency = "USD" | "EUR" | "GBP"

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

/** `active ⇄ frozen`, either to `cancelled`, and `cancelled` is terminal. */
export type CardStatus = "active" | "frozen" | "cancelled"

/** What the card is allowed to be used for. Chosen once, at issue. */
export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "shipping"
  | "other"

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

export interface Card {
  id: string
  merchantId: string
  nickname: string
  /**
   * The last four digits of the generated number. The full number is returned
   * once, in the creation response, and is never stored on this record.
   */
  last4: string
  /** Opaque handle for the generated number. Not the number, not derived from it. */
  numberRef: string
  /** Integer minor units. Never a float. */
  limit: number
  /** Integer minor units. Never a float. */
  spent: number
  currency: Currency
  category: CardCategory
  status: CardStatus
  /** ISO 8601, always UTC. */
  createdAt: string
  /** The client's issue token. A replay of it returns the same card. */
  requestId: string
  /** Every status this card has held, oldest first. ISO 8601, always UTC. */
  statusHistory: { status: CardStatus; at: string }[]
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
