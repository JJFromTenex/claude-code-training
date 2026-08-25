import { Badge } from "@/components/Badge"
import { CardStatus } from "@/data/types"
import { cx } from "@/lib/utils"

const LABELS: Record<CardStatus, string> = {
  active: "Active",
  frozen: "Frozen",
  cancelled: "Cancelled",
}

const DOTS: Record<CardStatus, string> = {
  active: "bg-emerald-600 dark:bg-emerald-400",
  frozen: "bg-blue-500 dark:bg-blue-500",
  cancelled: "bg-gray-500 dark:bg-gray-500",
}

const VARIANTS: Record<CardStatus, "success" | "default" | "neutral"> = {
  active: "success",
  frozen: "default",
  cancelled: "neutral",
}

export function CardStatusBadge({ status }: { status: CardStatus }) {
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
