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

/**
 * What a card may be spent on. Advisory metadata today: there is no
 * authorization path here to enforce it against.
 */
export type MerchantCategory =
  | "advertising"
  | "software"
  | "contractors"
  | "travel"
  | "office_supplies"

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
 * A virtual card. Single-merchant, always virtual, and limited from the moment
 * it exists.
 *
 * The full number is never a field here. It is returned exactly once, in the
 * creation response, and what survives is the last four plus a reference.
 */
export interface Card {
  id: string
  nickname: string
  merchantId: string
  /** Last four digits of the generated number. Never the whole PAN. */
  last4: string
  /** Opaque handle for the generated number. Not the number, not derivable from it. */
  reference: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units, in the same currency as the limit. */
  spend: number
  currency: Currency
  status: CardStatus
  /** Chosen at issue time. `null` means the card is not category-locked. */
  categoryLock: MerchantCategory | null
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
