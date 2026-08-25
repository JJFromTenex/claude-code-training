export type Currency = "USD" | "EUR" | "GBP"

export type PaymentStatus =
  | "authorized"
  | "captured"
  | "refunded"
  | "failed"
  | "disputed"

export type DisputeStatus = "needs_response" | "under_review" | "won" | "lost"

export type PayoutStatus = "paid" | "in_transit" | "pending"

export type CardStatus = "active" | "frozen" | "cancelled"

export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "utilities"

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

/** One entry in a card's status history. Written on issue and on every transition. */
export interface CardStatusEvent {
  /** Null on the issue event, which has no prior status. */
  from: CardStatus | null
  to: CardStatus
  /** ISO 8601, always UTC. */
  at: string
}

export interface Card {
  id: string
  nickname: string
  merchantId: string
  /**
   * The last four digits, and the only part of the number that is kept.
   * The full number exists in the creation response and nowhere else.
   */
  last4: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  currency: Currency
  status: CardStatus
  categoryLock: CardCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
  /** Oldest first. */
  history: CardStatusEvent[]
  /**
   * The caller's idempotency key, when one was supplied. A repeat of the same
   * key returns the original card rather than minting a second one.
   */
  requestId: string | null
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
