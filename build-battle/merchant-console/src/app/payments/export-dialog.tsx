"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Date",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Options for the payments export (NWP-101). Column defaults come from
 * DEFAULT_EXPORT_COLUMNS so the checkbox state and the server default cannot
 * drift apart — last4 starts unchecked because files go to merchants.
 * The server re-validates everything; this dialog is convenience, not
 * enforcement.
 */
export function ExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  query: string
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<ExportScope>("filtered")

  // Reset on every open so last4 is off by default each time, not only the
  // first — a stale selection is how an unedited file nearly went out.
  const onOpenChange = (open: boolean) => {
    if (open) {
      setSelected(new Set(DEFAULT_EXPORT_COLUMNS))
      setScope("filtered")
    }
  }

  const toggle = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  // Keep the canonical column order in the file regardless of click order.
  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))

  const href = () => {
    const params = new URLSearchParams(query)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  const rowCount = scope === "filtered" ? filteredCount : allCount

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose the columns and the scope. Card last four is off by
            default.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Columns
          </legend>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                  className="size-4 rounded border-gray-300 accent-blue-600 dark:border-gray-700"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
                className="size-4 border-gray-300 accent-blue-600 dark:border-gray-700"
              />
              Current filter ({filteredCount.toLocaleString()} rows)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 accent-blue-600 dark:border-gray-700"
              />
              All payments ({allCount.toLocaleString()} rows)
            </label>
          </div>
        </fieldset>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          <Button
            className="gap-2 py-1.5"
            disabled={columns.length === 0}
            asChild={columns.length > 0}
          >
            {columns.length > 0 ? (
              <a href={href()} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download {rowCount.toLocaleString()} rows
              </a>
            ) : (
              <span>Select at least one column</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
