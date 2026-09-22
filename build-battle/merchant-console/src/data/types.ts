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

/** The spend category a card is locked to at issue time. */
export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "contractors"
  | "office"
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

/**
 * A virtual card issued to a merchant.
 *
 * The full PAN is never stored: it exists only in the one-time creation
 * response. The record keeps the last four and an opaque reference. Amounts are
 * integer minor units in the card's currency.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Integer minor units. Never a float. */
  limit: number
  /** Amount spent against the limit, integer minor units, same currency. */
  spend: number
  currency: Currency
  /** Spend category the card is locked to, chosen at issue time. */
  category: CardCategory
  /** The card's actual last four digits (number uses the 4242 BIN). Mask with
   *  this, never a hardcoded "4242". The full PAN is never kept. */
  last4: string
  /** Opaque handle to the generated card; not the PAN. */
  reference: string
  status: CardStatus
  /** ISO 8601, always UTC. */
  createdAt: string
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
