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
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

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

type ExportScope = "current" | "all"

export function PaymentsExportDialog({
  currentQuery,
  currentCount,
  allCount,
}: {
  currentQuery: string
  currentCount: number
  allCount: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("current")

  const toggleColumn = (column: ExportColumn) => {
    setColumns((selected) =>
      selected.includes(column)
        ? selected.filter((selectedColumn) => selectedColumn !== column)
        : [...selected, column],
    )
  }

  const downloadHref = () => {
    const params = new URLSearchParams(scope === "current" ? currentQuery : "")
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  const rowCount = scope === "current" ? currentCount : allCount

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
          <div>
            <DrawerTitle>Export payments</DrawerTitle>
            <DrawerDescription>
              Choose the columns and payments to include in your CSV.
            </DrawerDescription>
          </div>
        </DrawerHeader>

        <DrawerBody>
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-3 space-y-3">
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="export-scope"
                  value="current"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-gray-900 dark:text-gray-50">
                    Current filter
                  </span>
                  <span className="text-gray-500">
                    {currentCount.toLocaleString()} payments
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="export-scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="mt-0.5"
                />
                <span>
                  <span className="block font-medium text-gray-900 dark:text-gray-50">
                    All payments
                  </span>
                  <span className="text-gray-500">
                    {allCount.toLocaleString()} payments
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-8">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {Object.entries(COLUMN_LABELS).map(([column, label]) => {
                const exportColumn = column as ExportColumn
                return (
                  <label
                    key={exportColumn}
                    className="flex items-center gap-3 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={columns.includes(exportColumn)}
                      onChange={() => toggleColumn(exportColumn)}
                      className="size-4 rounded border-gray-300"
                    />
                    <span className="text-gray-700 dark:text-gray-300">
                      {label}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <p className="mt-8 text-sm text-gray-500">
            {rowCount.toLocaleString()} payments will be included.
          </p>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <DrawerClose asChild>
            {columns.length > 0 ? (
              <Button asChild>
                <a href={downloadHref()}>Download CSV</a>
              </Button>
            ) : (
              <Button disabled>Download CSV</Button>
            )}
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
