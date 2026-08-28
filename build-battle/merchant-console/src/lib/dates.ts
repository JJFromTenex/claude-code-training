/**
 * Storage and bucketing are UTC. Display converts to the merchant's timezone,
 * and nothing else does.
 */

/** The UTC calendar day an instant falls on, as YYYY-MM-DD. */
export function utcDayKey(iso: string): string {
  return iso.slice(0, 10)
}

/** The calendar day an instant falls on in a given IANA timezone. */
export function dayKeyInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso))
}

/** Readable timestamp for a merchant, in their own timezone. */
export function formatInZone(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

/** Short date for tables. UTC, because tables are scanned not reconciled. */
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    dateStyle: "medium",
  }).format(new Date(iso))
}

/**
 * Widen an inclusive upper bound so a date-only value covers its whole UTC day.
 * Filters compare against full ISO instants, so a bare "2026-08-13" would
 * otherwise exclude every payment made on the 13th. Full timestamps pass
 * through untouched.
 */
export function utcRangeEnd(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value
}

/** Inclusive list of UTC day keys, oldest first. */
export function lastUtcDays(days: number, from: Date): string[] {
  const keys: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(from)
    day.setUTCDate(day.getUTCDate() - i)
    keys.push(day.toISOString().slice(0, 10))
  }
  return keys
}

/** Whole days from now until an instant. Negative once it has passed. */
export function daysUntil(iso: string, now: Date): number {
  const ms = new Date(iso).getTime() - now.getTime()
  return Math.ceil(ms / 86_400_000)
}
