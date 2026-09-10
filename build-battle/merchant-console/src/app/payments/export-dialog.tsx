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
  type ExportColumn,
  type ExportScope,
} from "@/lib/csv"
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

export function PaymentsExportDialog({
  query,
  currentCount,
  allCount,
}: {
  query: string
  currentCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<ExportScope>("current")

  const toggle = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const orderedColumns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const nothingSelected = orderedColumns.length === 0
  const rowCount = scope === "current" ? currentCount : allCount

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", orderedColumns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="secondary"
          className="w-full gap-2 py-1.5 sm:w-fit"
        >
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose the columns and the scope. The file downloads to your browser.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  name="columns"
                  value={column}
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                  className="size-4 rounded border-gray-300 text-blue-600 accent-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:focus:ring-blue-700/30"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="current"
                checked={scope === "current"}
                onChange={() => setScope("current")}
                className="size-4 border-gray-300 text-blue-600 accent-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:focus:ring-blue-700/30"
              />
              Current filter — {currentCount.toLocaleString()} payments
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-600 accent-blue-600 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:focus:ring-blue-700/30"
              />
              All payments — {allCount.toLocaleString()} payments
            </label>
          </fieldset>

          <p
            aria-live="polite"
            className="text-sm text-gray-500 dark:text-gray-500"
          >
            {nothingSelected
              ? "Select at least one column to export."
              : `${rowCount.toLocaleString()} ${
                  rowCount === 1 ? "row" : "rows"
                } will be exported.`}
          </p>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {nothingSelected ? (
            <Button className="py-1.5" disabled aria-disabled="true">
              Download
            </Button>
          ) : (
            <Button className="py-1.5" asChild>
              <a href={href} onClick={() => setOpen(false)}>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
