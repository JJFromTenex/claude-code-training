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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
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
 * The export options ops sees before downloading (NWP-101).
 *
 * The choices made here are a convenience: the route allowlists the column
 * names and the scope again, and rejects an empty selection on its own.
 */
export function PaymentsExportDialog({
  query,
  filteredTotal,
  allTotal,
}: {
  /** The current filter querystring, so an export matches what is on screen. */
  query: string
  filteredTotal: number
  allTotal: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")

  const rowCount = scope === "all" ? allTotal : filteredTotal
  const nothingSelected = columns.length === 0

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : [...current, column],
    )

  const href = () => {
    const current = new URLSearchParams(query)
    const params = new URLSearchParams()

    if (scope === "all") {
      // Scope is the whole table, so the filters go; ordering still follows
      // whatever the table is sorted by.
      for (const key of ["sort", "direction"]) {
        const value = current.get(key)
        if (value) params.set(key, value)
      }
    } else {
      for (const [key, value] of current) {
        if (key !== "page") params.set(key, value)
      }
    }

    params.set("scope", scope)
    params.set(
      "columns",
      EXPORT_COLUMNS.filter((column) => columns.includes(column)).join(","),
    )
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Dialog>
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
            Choose what goes in the file before you download it.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            {(
              [
                ["filtered", "Current filter", filteredTotal],
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
                  className={cx(
                    "size-4 border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900",
                    focusRing,
                  )}
                />
                <label
                  htmlFor={`scope-${value}`}
                  className="text-sm text-gray-900 dark:text-gray-50"
                >
                  {label}{" "}
                  <span className="text-gray-500">
                    ({count.toLocaleString()})
                  </span>
                </label>
              </div>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                    className={cx(
                      "size-4 rounded border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900",
                      focusRing,
                    )}
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

          <p
            aria-live="polite"
            className="text-sm text-gray-500 dark:text-gray-500"
          >
            {nothingSelected
              ? "Select at least one column to export."
              : `${rowCount.toLocaleString()} ${
                  rowCount === 1 ? "payment" : "payments"
                } · ${columns.length} ${
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
          {nothingSelected ? (
            <Button className="py-1.5" disabled>
              Download
            </Button>
          ) : (
            <DialogClose asChild>
              <Button className="py-1.5" asChild>
                <a href={href()}>Download</a>
              </Button>
            </DialogClose>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
