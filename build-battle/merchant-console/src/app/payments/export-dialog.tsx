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
import { useState } from "react"

/**
 * The export options dialog (NWP-101).
 *
 * Built on Drawer, which is the console's Radix dialog — focus trap, focus
 * return, and Escape come with it. Columns and scope are native labeled
 * inputs inside fieldsets rather than a new checkbox dependency.
 *
 * Row counts are passed in from the server page, which already has the query
 * builder in scope. The dialog fetches nothing and filters nothing; it only
 * builds the href the export route already knows how to answer.
 */

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

export function ExportDialog({
  query,
  filteredTotal,
  allTotal,
}: {
  query: string
  filteredTotal: number
  allTotal: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<"filter" | "all">("filter")

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : // Keep the allowlist's order regardless of click order, so the header
          // row is stable between exports.
          EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )

  const rowCount = scope === "all" ? allTotal : filteredTotal

  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.delete("page")
  params.set("columns", selected.join(","))
  params.set("scope", scope)
  const href = `/api/payments/export?${params.toString()}`

  const canDownload = selected.length > 0

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

        <DrawerBody className="space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <p className="text-sm text-gray-500">
              Card last four is off by default. Turn it on only for files that
              stay internal.
            </p>
            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
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

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="export-scope-filter"
                name="scope"
                value="filter"
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
              />
              <label
                htmlFor="export-scope-filter"
                className="text-sm text-gray-900 dark:text-gray-50"
              >
                Current filter ({filteredTotal.toLocaleString()} payments)
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="export-scope-all"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
              />
              <label
                htmlFor="export-scope-all"
                className="text-sm text-gray-900 dark:text-gray-50"
              >
                All payments ({allTotal.toLocaleString()} payments)
              </label>
            </div>
          </fieldset>

          <p
            className="text-sm text-gray-500"
            aria-live="polite"
            role="status"
          >
            {canDownload ? (
              <>
                Exporting {rowCount.toLocaleString()}{" "}
                {rowCount === 1 ? "payment" : "payments"} and{" "}
                {selected.length} {selected.length === 1 ? "column" : "columns"}
                .
              </>
            ) : (
              <>Select at least one column to download.</>
            )}
          </p>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="mt-2 w-full sm:mt-0 sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          <Button
            className="w-full gap-2 sm:w-fit"
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
