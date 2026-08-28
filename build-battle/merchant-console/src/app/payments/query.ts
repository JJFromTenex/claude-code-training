/**
 * The three filters the payments page applies, and the one way they become
 * a query string. The filter bar uses it to navigate; the export dialog uses
 * it to ask the route for the same rows the table is showing.
 */

export interface PaymentsPageFilters {
  status: string
  merchantId: string
  search: string
}

export function paymentsQuery(current: PaymentsPageFilters): URLSearchParams {
  const query = new URLSearchParams()
  if (current.status && current.status !== "all") query.set("status", current.status)
  if (current.merchantId) query.set("merchantId", current.merchantId)
  if (current.search) query.set("search", current.search)
  return query
}
