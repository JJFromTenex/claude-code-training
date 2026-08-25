import { generate } from "./generate"
import { merchants } from "./merchants"
import { Card, Dispute, Payment, Payout, Refund } from "./types"

/**
 * In-memory store.
 *
 * Data is generated once at boot and lives for the life of the process.
 * Writes survive the session and vanish on restart. That is deliberate:
 * persistence is NWP-203 and is out of scope for workshop exercises.
 *
 * Held on globalThis so the Next.js dev server's module reloading does not
 * hand every request a fresh copy.
 */

interface Store {
  merchants: typeof merchants
  payments: Payment[]
  refunds: Refund[]
  disputes: Dispute[]
  payouts: Payout[]
  /** No seed data — every card starts empty until ops issues one. */
  cards: Card[]
  /**
   * Idempotency-Key -> the response already sent for it. A retried
   * POST /api/cards with the same key gets back exactly what the first
   * request got, including the one-time number, instead of issuing a
   * second card.
   */
  cardIssuance: Map<string, { card: Card; number: string }>
}

declare global {
  // eslint-disable-next-line no-var
  var __northwindStore: Store | undefined
}

function createStore(): Store {
  const { payments, refunds, disputes, payouts } = generate()
  return {
    merchants,
    payments,
    refunds,
    disputes,
    payouts,
    cards: [],
    cardIssuance: new Map(),
  }
}

export const store: Store = globalThis.__northwindStore ?? createStore()

if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindStore = store
}
