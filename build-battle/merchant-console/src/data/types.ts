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

/**
 * The category a card is locked to at issue. Chosen once and shown on the
 * card; enforcing it against an authorisation needs card transactions, which
 * this console does not have.
 */
export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "supplies"

/** One entry in a card's history. Cards are audited, so nothing is silent. */
export interface CardEvent {
  /** ISO 8601, always UTC. */
  at: string
  status: CardStatus
  note: string
}

export interface Card {
  id: string
  merchantId: string
  nickname: string
  /**
   * The last four of the generated number. The full number is returned once,
   * in the creation response, and is never stored or re-read.
   */
  last4: string
  /** Opaque handle for the generated number. Not the number, not derived from it. */
  reference: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units authorised against the card so far. */
  spent: number
  currency: Currency
  status: CardStatus
  category: CardCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
  history: CardEvent[]
}
