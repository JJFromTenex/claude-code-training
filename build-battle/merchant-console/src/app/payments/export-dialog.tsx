"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
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
  created_at: "Created at (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

export function PaymentsExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((name) => name !== column)
        : // Keep the canonical order so the file reads the way the table does.
          EXPORT_COLUMNS.filter(
            (name) => current.includes(name) || name === column,
          ),
    )

  const rowCount = scope === "all" ? totalCount : filteredCount
  const empty = columns.length === 0

  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.set("columns", columns.join(","))
  params.set("scope", scope)
  const href = `/api/payments/export?${params.toString()}`

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
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
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
                  className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                <label
                  htmlFor={`scope-${value}`}
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  {label}
                  <span className="ml-1 text-gray-500 dark:text-gray-500">
                    — {count.toLocaleString()} payments
                  </span>
                </label>
              </div>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <div key={column} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`column-${column}`}
                  checked={columns.includes(column)}
                  onChange={() => toggle(column)}
                  className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                <label
                  htmlFor={`column-${column}`}
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  {COLUMN_LABELS[column]}
                </label>
              </div>
            ))}
            {empty && (
              <p className="text-sm text-red-600 dark:text-red-500">
                Select at least one column to export.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {empty ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download {rowCount.toLocaleString()} payments
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
