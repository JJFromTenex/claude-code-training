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
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  EXPORT_COLUMN_LABELS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const CHECKBOX_CLASS =
  "size-4 shrink-0 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"

export function PaymentsExportDialog({
  query,
  filteredCount,
  allCount,
}: {
  /** The current filter as a query string, without pagination. */
  query: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("filter")
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const rowCount = scope === "all" ? allCount : filteredCount
  const nothingSelected = columns.length === 0

  const toggle = (column: ExportColumn, checked: boolean) => {
    setColumns((current) =>
      checked
        ? EXPORT_COLUMNS.filter((c) => c === column || current.includes(c))
        : current.filter((c) => c !== column),
    )
  }

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", columns.join(","))
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
          <DrawerDescription className="text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="filter"
                  checked={scope === "filter"}
                  onChange={() => setScope("filter")}
                  className={CHECKBOX_CLASS}
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
                  className={CHECKBOX_CLASS}
                />
                All payments
              </label>
            </div>
            <p
              className="mt-2 text-sm text-gray-500"
              aria-live="polite"
              data-testid="export-row-count"
            >
              {rowCount.toLocaleString()}{" "}
              {rowCount === 1 ? "payment" : "payments"} will be exported
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  htmlFor={`export-column-${column}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    id={`export-column-${column}`}
                    type="checkbox"
                    checked={columns.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className={CHECKBOX_CLASS}
                  />
                  {EXPORT_COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {nothingSelected && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <Button
            variant="secondary"
            className="py-1.5"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          {nothingSelected ? (
            <Button className="gap-2 py-1.5" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          ) : (
            <Button className="gap-2 py-1.5" asChild>
              <a href={href} onClick={() => setOpen(false)}>
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
