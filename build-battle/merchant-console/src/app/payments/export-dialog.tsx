"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { DEFAULT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
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
 * The export options ops asked for. The column set and the scope both travel
 * as query parameters and are re-checked by the route; disabling Download on an
 * empty selection is a courtesy, not the guard.
 */
export function ExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The page's current filter query string, forwarded so the file matches the table. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_COLUMNS),
  )
  const [scope, setScope] = useState<"filtered" | "all">("filtered")

  // Emit in the table's own column order rather than the order they were ticked,
  // so two people picking the same columns get the same file.
  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? totalCount : filteredCount

  const toggle = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const params = new URLSearchParams(query)
  // The export is never paginated, so the table's page number is meaningless here.
  params.delete("page")
  params.set("columns", columns.join(","))
  if (scope === "all") params.set("scope", "all")
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
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
          <DrawerDescription>
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
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
                  className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="filtered"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
              Current filter
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
              All payments
            </label>
          </fieldset>
        </DrawerBody>

        <DrawerFooter className="items-center gap-3 sm:justify-between">
          <p
            className="text-sm text-gray-500 dark:text-gray-500"
            aria-live="polite"
          >
            {columns.length === 0
              ? "Pick at least one column"
              : `${rowCount.toLocaleString()} ${rowCount === 1 ? "payment" : "payments"} · ${columns.length} ${columns.length === 1 ? "column" : "columns"}`}
          </p>
          {columns.length === 0 ? (
            <Button className="gap-2" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          ) : (
            <Button className="gap-2" asChild>
              <a href={href} download>
                <Download
                  className="-ml-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
