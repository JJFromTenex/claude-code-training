import { Badge } from "@/components/Badge"
import { CardStatus, DisputeStatus, PaymentStatus, PayoutStatus } from "@/data/types"
import { cx } from "@/lib/utils"

type AnyStatus = PaymentStatus | DisputeStatus | PayoutStatus | CardStatus

const LABELS: Record<AnyStatus, string> = {
  authorized: "Authorized",
  captured: "Captured",
  refunded: "Refunded",
  failed: "Failed",
  disputed: "Disputed",
  needs_response: "Needs response",
  under_review: "Under review",
  won: "Won",
  lost: "Lost",
  paid: "Paid",
  in_transit: "In transit",
  pending: "Pending",
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

const DOTS: Record<AnyStatus, string> = {
  authorized: "bg-blue-500 dark:bg-blue-500",
  captured: "bg-emerald-600 dark:bg-emerald-400",
  refunded: "bg-gray-500 dark:bg-gray-500",
  failed: "bg-red-500 dark:bg-red-500",
  disputed: "bg-orange-500 dark:bg-orange-500",
  needs_response: "bg-orange-500 dark:bg-orange-500",
  under_review: "bg-blue-500 dark:bg-blue-500",
  won: "bg-emerald-600 dark:bg-emerald-400",
  lost: "bg-red-500 dark:bg-red-500",
  paid: "bg-emerald-600 dark:bg-emerald-400",
  in_transit: "bg-blue-500 dark:bg-blue-500",
  pending: "bg-gray-500 dark:bg-gray-500",
  active: "bg-emerald-600 dark:bg-emerald-400",
  frozen: "bg-blue-500 dark:bg-blue-500",
  cancelled: "bg-gray-500 dark:bg-gray-500",
}

const VARIANTS: Record<AnyStatus, "default" | "neutral" | "success" | "error" | "warning"> = {
  authorized: "default",
  captured: "success",
  refunded: "neutral",
  failed: "error",
  disputed: "warning",
  needs_response: "warning",
  under_review: "default",
  won: "success",
  lost: "error",
  paid: "success",
  in_transit: "default",
  pending: "neutral",
  active: "success",
  frozen: "default",
  cancelled: "neutral",
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  return (
    <Badge variant={VARIANTS[status]} className="rounded-full">
      <span
        className={cx("size-1.5 shrink-0 rounded-full", DOTS[status])}
        aria-hidden="true"
      />
      {LABELS[status]}
    </Badge>
  )
}
