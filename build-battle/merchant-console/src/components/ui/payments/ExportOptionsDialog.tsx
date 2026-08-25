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
import { Download } from "lucide-react"
import { useMemo, useState } from "react"

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

type Scope = "filter" | "all"

export function ExportOptionsDialog({
  filterQuery,
  filteredCount,
  allCount,
}: {
  /** The current page's active filters, already a query string (no leading `?`). */
  filterQuery: string
  /** Row count for "current filter" scope. */
  filteredCount: number
  /** Row count for "all payments" scope. */
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("filter")

  const rowCount = scope === "all" ? allCount : filteredCount
  const hasColumns = selected.size > 0

  const downloadHref = useMemo(() => {
    const params = new URLSearchParams(filterQuery)
    if (scope === "all") params.set("scope", "all")
    const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }, [filterQuery, scope, selected])

  const toggleColumn = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose which columns and which payments go into the file.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="flex flex-col gap-2">
              {EXPORT_COLUMNS.map((column) => {
                const inputId = `export-column-${column}`
                return (
                  <div key={column} className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={selected.has(column)}
                      onChange={() => toggleColumn(column)}
                      className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                    />
                    <label
                      htmlFor={inputId}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {COLUMN_LABELS[column]}
                    </label>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  id="export-scope-filter"
                  type="radio"
                  name="export-scope"
                  checked={scope === "filter"}
                  onChange={() => setScope("filter")}
                  className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                />
                <label
                  htmlFor="export-scope-filter"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  Current filter
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="export-scope-all"
                  type="radio"
                  name="export-scope"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                />
                <label
                  htmlFor="export-scope-all"
                  className="text-sm text-gray-700 dark:text-gray-300"
                >
                  All payments
                </label>
              </div>
            </div>
          </fieldset>

          <p className="text-sm text-gray-500">
            {rowCount.toLocaleString()}{" "}
            {rowCount === 1 ? "payment" : "payments"} will be exported.
          </p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button
            variant="primary"
            disabled={!hasColumns}
            onClick={() => {
              window.location.assign(downloadHref)
            }}
          >
            Download
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
