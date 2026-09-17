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
  buildExportHref,
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
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

export function ExportDialog({
  query,
  total,
  allTotal,
}: {
  query: string
  total: number
  allTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("current")
  const [columns, setColumns] = useState<readonly ExportColumn[]>(DEFAULT_EXPORT_COLUMNS)

  const resetToDefaults = () => {
    setScope("current")
    setColumns(DEFAULT_EXPORT_COLUMNS)
  }

  const toggleColumn = (column: ExportColumn) => {
    setColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )
  }

  const rowCount = scope === "all" ? allTotal : total

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (next) resetToDefaults()
        setOpen(next)
      }}
    >
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
            Download the payments list as a CSV file.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="export-scope-current"
                  name="export-scope"
                  value="current"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                  className="size-4 border-gray-300 text-blue-500 dark:border-gray-700"
                />
                <label
                  htmlFor="export-scope-current"
                  className="text-sm text-gray-900 dark:text-gray-50"
                >
                  Current filter
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="export-scope-all"
                  name="export-scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="size-4 border-gray-300 text-blue-500 dark:border-gray-700"
                />
                <label
                  htmlFor="export-scope-all"
                  className="text-sm text-gray-900 dark:text-gray-50"
                >
                  All payments
                </label>
              </div>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {rowCount.toLocaleString()} payments will be exported
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    checked={columns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className="size-4 rounded border-gray-300 text-blue-500 dark:border-gray-700"
                  />
                  <label
                    htmlFor={`export-column-${column}`}
                    className="text-sm text-gray-900 dark:text-gray-50"
                  >
                    {COLUMN_LABELS[column]}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {columns.length === 0 ? (
            <div className="flex flex-col items-end gap-1">
              <Button disabled>Download</Button>
              <p className="text-xs text-gray-500">Select at least one column.</p>
            </div>
          ) : (
            <Button asChild onClick={() => setOpen(false)}>
              <a href={buildExportHref(query, scope, columns)}>Download</a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
