"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table.
 *
 * The row counts are handed down from the server component, so nothing here
 * fetches payments — building the file in the browser would export the page
 * ops is looking at rather than the whole result set.
 */

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

const checkboxStyles = cx(
  "size-4 shrink-0 rounded border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-950",
  focusRing,
)

type Scope = "filtered" | "all"

export function ExportDialog({
  filterQuery,
  filteredCount,
  totalCount,
}: {
  /** The querystring the table is currently filtered by. */
  filterQuery: string
  filteredCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<Scope>("filtered")
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  // Keep the file's column order matching the order shown in this dialog.
  const columns = EXPORT_COLUMNS.filter((column) => selected.includes(column))
  const rowCount = scope === "all" ? totalCount : filteredCount

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column],
    )

  const href = () => {
    // "All payments" ignores the table's filters; the server drops them too.
    const params =
      scope === "all" ? new URLSearchParams() : new URLSearchParams(filterQuery)
    params.delete("page") // the export is never paginated
    params.set("columns", columns.join(","))
    params.set("scope", scope)
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm">
            Pick the columns and how much of the table to include.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filtered", "Current filter", filteredCount],
                  ["all", "All payments", totalCount],
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
                    className={checkboxStyles}
                  />
                  <label
                    htmlFor={`scope-${value}`}
                    className="text-sm text-gray-900 dark:text-gray-50"
                  >
                    {label}{" "}
                    <span className="text-gray-500 tabular-nums">
                      ({count.toLocaleString()} payments)
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`column-${column}`}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className={checkboxStyles}
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
            <p className="mt-3 text-xs text-gray-500">
              Card last four is off by default — leave it out of anything going
              to a merchant.
            </p>
          </fieldset>

          {columns.length === 0 && (
            <p className="text-sm text-red-600 dark:text-red-500">
              Select at least one column to export.
            </p>
          )}
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {columns.length > 0 ? (
            <Button className="gap-2 py-1.5" asChild>
              <a href={href()} onClick={() => setOpen(false)}>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download {rowCount.toLocaleString()} rows
              </a>
            </Button>
          ) : (
            <Button className="gap-2 py-1.5" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
