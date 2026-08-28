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
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

/** Column names are the CSV header; these are what ops reads on screen. */
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

const checkboxStyles =
  "size-4 shrink-0 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"

export function PaymentsExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The page's current filter query string. */
  query: string
  /** Rows the active filter matches, across every page. */
  filteredCount: number
  /** Every payment, ignoring the filter bar. */
  totalCount: number
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")

  const toggle = (column: ExportColumn) =>
    setColumns((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : // Keep the file in EXPORT_COLUMNS order however the boxes are clicked.
          EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )

  const rowCount = scope === "all" ? totalCount : filteredCount
  const canDownload = columns.length > 0

  const params = new URLSearchParams(query)
  // The export is every matching row, so the table's page number is noise —
  // and a hazard for anyone who later routes this through queryPayments.
  params.delete("page")
  if (scope === "all") {
    // Scope "all" ignores the filter bar; sending its params would only confuse
    // the filename slug.
    for (const key of ["status", "merchantId", "search", "from", "to"]) {
      params.delete(key)
    }
    params.set("scope", "all")
  }
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`

  return (
    <Drawer>
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
          <DrawerTitle>Export options</DrawerTitle>
          <DrawerDescription className="text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  htmlFor={`export-column-${column}`}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    className={checkboxStyles}
                    checked={columns.includes(column)}
                    onChange={() => toggle(column)}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {!canDownload && (
              <p className="text-sm text-red-600 dark:text-red-500">
                Select at least one column to export.
              </p>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label
              htmlFor="export-scope-filtered"
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <input
                type="radio"
                id="export-scope-filtered"
                name="export-scope"
                className={checkboxStyles}
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
              />
              Current filter
            </label>
            <label
              htmlFor="export-scope-all"
              className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
            >
              <input
                type="radio"
                id="export-scope-all"
                name="export-scope"
                className={checkboxStyles}
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              All payments
            </label>
          </fieldset>

          <p className="text-sm text-gray-500" aria-live="polite">
            {rowCount.toLocaleString()}{" "}
            {rowCount === 1 ? "payment" : "payments"} ·{" "}
            {columns.length} {columns.length === 1 ? "column" : "columns"}
          </p>
        </DrawerBody>

        <DrawerFooter>
          {/* `disabled` does nothing on an anchor, so the element changes with
              the state — the same swap the pagination buttons make. */}
          <Button
            className="gap-2"
            disabled={!canDownload}
            asChild={canDownload}
          >
            {canDownload ? (
              <a href={href} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </a>
            ) : (
              <span>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </span>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
