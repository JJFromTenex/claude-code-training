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
  cards: Card[]
  /** Idempotency-Key -> card id, so a repeated key never mints a second card. */
  cardIdempotencyKeys: Map<string, string>
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
    cardIdempotencyKeys: new Map(),
  }
}

export const store: Store = globalThis.__northwindStore ?? createStore()

// A dev server that was running before `cards` existed keeps the old object
// shape across hot reloads. Guard so the new fields exist even then, rather
// than relying on a restart.
store.cards ??= []
store.cardIdempotencyKeys ??= new Map()

if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindStore = store
}
