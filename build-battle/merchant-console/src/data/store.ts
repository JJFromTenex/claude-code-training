import { generate } from "./generate"
import { merchants } from "./merchants"
import { Card, CardEvent, Dispute, Payment, Payout, Refund } from "./types"

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
  cardEvents: CardEvent[]
  /** Idempotency key to the card it created. A replay never re-reveals a number. */
  cardIdempotency: Record<string, { cardId: string; fingerprint: string }>
}

declare global {
  // eslint-disable-next-line no-var
  var __northwindStore: Store | undefined
}

function createStore(): Store {
  const { payments, refunds, disputes, payouts } = generate()
  // No cards are seeded: the list opens on its empty state until one is issued.
  return { merchants, payments, refunds, disputes, payouts, cards: [], cardEvents: [], cardIdempotency: {} }
}

export const store: Store = globalThis.__northwindStore ?? createStore()

// A dev server started before NWP-201 has no card collections. Fill them in
// rather than let a route read undefined.
const carried = store as Partial<Store>
carried.cards ??= []
carried.cardEvents ??= []
carried.cardIdempotency ??= {}

if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindStore = store
}
