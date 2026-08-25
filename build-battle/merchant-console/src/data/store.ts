import { generate } from "./generate"
import { generateCards } from "./generate-cards"
import { merchants } from "./merchants"
import {
  Card,
  CardAuthorization,
  CardEvent,
  Dispute,
  Payment,
  Payout,
  Refund,
} from "./types"

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
  /** Spend is summed from these. A card never carries a stored total. */
  cardAuthorizations: CardAuthorization[]
  /** The card audit trail, oldest first. */
  cardEvents: CardEvent[]
  /**
   * Idempotency key to card id, so a double-clicked issue button produces one
   * card rather than two. Lives with the store because it shares its lifetime.
   */
  issuedByKey: Map<string, string>
}

declare global {
  // eslint-disable-next-line no-var
  var __northwindStore: Store | undefined
}

function createStore(): Store {
  const { payments, refunds, disputes, payouts } = generate()
  const { cards, cardAuthorizations, cardEvents } = generateCards()
  return {
    merchants,
    payments,
    refunds,
    disputes,
    payouts,
    cards,
    cardAuthorizations,
    cardEvents,
    issuedByKey: new Map(),
  }
}

export const store: Store = globalThis.__northwindStore ?? createStore()

if (process.env.NODE_ENV !== "production") {
  globalThis.__northwindStore = store
}
