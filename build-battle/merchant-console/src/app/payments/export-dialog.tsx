"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import { ExportScope } from "@/data/queries"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table.
 *
 * The browser only composes a URL — the CSV is built server-side, so the file
 * covers every matching row rather than the twenty on screen. What is ticked
 * here is a convenience; `parseExportOptions` is the enforcement.
 */

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

const control = cx(
  "size-4 shrink-0 border-gray-300 text-blue-500 dark:border-gray-700",
  "bg-white dark:bg-gray-950",
  focusRing,
)

export function PaymentsExportDialog({
  query,
  filteredTotal,
  allTotal,
}: {
  query: string
  filteredTotal: number
  allTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filter")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const rowCount = scope === "all" ? allTotal : filteredTotal
  const empty = columns.length === 0

  // Keep the allowlist's order rather than the order boxes were ticked, so a
  // file looks the same however ops arrived at the selection.
  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )

  const href = () => {
    const params = new URLSearchParams(query)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <DialogDescription className="text-sm">
            Card details are left out unless you ask for them.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows to include
            </legend>
            {(
              [
                ["filter", "Current filter", filteredTotal],
                ["all", "All payments", allTotal],
              ] as const
            ).map(([value, label, count]) => (
              <div key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={`scope-${value}`}
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className={control}
                />
                <label
                  htmlFor={`scope-${value}`}
                  className="text-sm text-gray-900 dark:text-gray-50"
                >
                  {label}
                  <span className="ml-1.5 tabular-nums text-gray-500">
                    {count.toLocaleString()}
                  </span>
                </label>
              </div>
            ))}
          </fieldset>

          <fieldset>
            <legend className="mb-3 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className={cx(control, "rounded")}
                  />
                  <label
                    htmlFor={`column-${column}`}
                    className="text-sm text-gray-900 dark:text-gray-50"
                  >
                    {COLUMN_LABELS[column]}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-gray-500" role="status" aria-live="polite">
            {empty
              ? "Choose at least one column to export."
              : `${rowCount.toLocaleString()} payments · ${columns.length} ${
                  columns.length === 1 ? "column" : "columns"
                }`}
          </p>
        </DialogBody>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          {/* A disabled anchor still navigates, so an empty selection gets a
              real button instead of a link. */}
          <Button
            className="gap-2 py-1.5"
            disabled={empty}
            asChild={!empty}
            onClick={() => !empty && setOpen(false)}
          >
            {empty ? (
              <span>Download CSV</span>
            ) : (
              <a href={href()} download>
                Download CSV
              </a>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
