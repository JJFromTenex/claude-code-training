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

export type CardStatus = "active" | "frozen" | "cancelled"

/** What a card may be spent on. Chosen at issue time; changing it is NWP-202. */
export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "utilities"

export type CardEventType = "issued" | "frozen" | "unfrozen" | "cancelled"

/** One entry in a card's audit trail. Append-only. */
export interface CardEvent {
  type: CardEventType
  /** ISO 8601, always UTC. */
  at: string
}

export interface Card {
  id: string
  merchantId: string
  nickname: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units. Authorized spend against the limit. */
  spend: number
  currency: Currency
  status: CardStatus
  /**
   * Last four of the generated number. The full number is returned exactly
   * once, in the issue response, and is never stored or re-readable.
   */
  last4: string
  /** Opaque handle for the issued number. Not the number, not derived from it. */
  reference: string
  categoryLock: CardCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
  /** Audit trail, oldest first. Answers "what happened to this card". */
  events: CardEvent[]
}

export interface CardFilters {
  status?: CardStatus | "all"
  merchantId?: string
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
