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

export type MerchantCategory =
  | "software"
  | "advertising"
  | "travel"
  | "office_supplies"
  | "professional_services"

/** One status change. `from` is null for the issue itself. */
export interface CardEvent {
  /** ISO 8601, always UTC. */
  at: string
  from: CardStatus | null
  to: CardStatus
}

/**
 * A virtual card. There is deliberately no field for the full number: it is
 * returned once, in the creation response, and never stored.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units. Nothing links payments to cards yet, so this is 0. */
  spent: number
  currency: Currency
  /** Chosen at issue; the card only works at merchants in this category. */
  category: MerchantCategory
  last4: string
  /** Opaque reference to the generated number, not the number itself. */
  numberRef: string
  status: CardStatus
  /** ISO 8601, always UTC. */
  createdAt: string
  history: CardEvent[]
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
