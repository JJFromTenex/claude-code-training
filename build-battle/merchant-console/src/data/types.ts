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

export type CardCategory =
  | "advertising"
  | "software"
  | "travel"
  | "office_supplies"
  | "professional_services"

export interface CardEvent {
  /** ISO 8601, always UTC. */
  at: string
  event: "issued" | "frozen" | "unfrozen" | "cancelled"
}

export interface Card {
  id: string
  merchantId: string
  nickname: string
  /** Last four digits of the generated number. The full PAN is never stored. */
  last4: string
  /** Opaque reference to the issued number. Cannot be turned back into a PAN. */
  numberRef: string
  /** Integer minor units. Never a float. */
  spendLimit: number
  /** Integer minor units spent so far against the limit. */
  spent: number
  currency: Currency
  status: CardStatus
  /** Merchant category the card is locked to, or null for unrestricted. */
  categoryLock: CardCategory | null
  /** ISO 8601, always UTC. */
  createdAt: string
  /** What happened to the card and when, oldest first. */
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
