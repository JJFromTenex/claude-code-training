import { Badge } from "@/components/Badge"
import { CardStatus } from "@/data/types"

const statusConfig: Record<
  CardStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
  },
  frozen: {
    label: "Frozen",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  },
}

export function CardStatusBadge({ status }: { status: CardStatus }) {
  const config = statusConfig[status]
  return <Badge className={config.className}>{config.label}</Badge>
}
