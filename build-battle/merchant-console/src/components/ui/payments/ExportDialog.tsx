"use client"

import { useId, useState } from "react"
import { Download } from "lucide-react"

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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"

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

export function ExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  /** The payments page's current filter querystring, e.g. "status=disputed". */
  query: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filtered")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const fieldId = useId()

  const toggleColumn = (column: ExportColumn) => {
    setColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column],
    )
  }

  const canDownload = columns.length > 0
  const rowCount = scope === "filtered" ? filteredCount : allCount

  const download = () => {
    const params = new URLSearchParams(query)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    window.location.href = `/api/payments/export?${params.toString()}`
    setOpen(false)
  }

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
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the file before it downloads.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              <label
                htmlFor={`${fieldId}-scope-filtered`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`${fieldId}-scope-filtered`}
                  type="radio"
                  name={`${fieldId}-scope`}
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                />
                Current filter &middot; {filteredCount.toLocaleString()} rows
              </label>
              <label
                htmlFor={`${fieldId}-scope-all`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`${fieldId}-scope-all`}
                  type="radio"
                  name={`${fieldId}-scope`}
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="size-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                />
                All payments &middot; {allCount.toLocaleString()} rows
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  htmlFor={`${fieldId}-col-${column}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    id={`${fieldId}-col-${column}`}
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={() => toggleColumn(column)}
                    className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {!canDownload && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={download} disabled={!canDownload}>
            {canDownload ? `Download (${rowCount.toLocaleString()} rows)` : "Download"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
