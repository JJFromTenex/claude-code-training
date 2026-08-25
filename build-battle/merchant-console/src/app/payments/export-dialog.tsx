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
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table.
 *
 * The dialog composes a URL and lets the browser download it. Every choice
 * made here is re-checked by the route handler — disabling Download on an
 * empty selection is a courtesy, not the enforcement.
 */

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

type Scope = "filtered" | "all"

export function ExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The page's active filter params, forwarded to the export unchanged. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<Scope>("filtered")

  const rowCount = scope === "all" ? totalCount : filteredCount
  const canDownload = selected.length > 0 && rowCount > 0

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column],
    )

  const href = () => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.delete("columns")
    params.delete("scope")
    if (scope === "all") params.set("scope", "all")
    for (const column of EXPORT_COLUMNS) {
      if (selected.includes(column)) params.append("columns", column)
    }
    return `/api/payments/export?${params.toString()}`
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

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
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
                className={cx(
                  "size-4 border-gray-300 text-blue-600 dark:border-gray-700 dark:bg-gray-900",
                  focusRing,
                )}
              />
              Current filter
              <span className="text-gray-500">
                — {filteredCount.toLocaleString()} payments
              </span>
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className={cx(
                  "size-4 border-gray-300 text-blue-600 dark:border-gray-700 dark:bg-gray-900",
                  focusRing,
                )}
              />
              All payments
              <span className="text-gray-500">
                — {totalCount.toLocaleString()} payments
              </span>
            </label>
          </fieldset>

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
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                  className={cx(
                    "size-4 rounded border-gray-300 text-blue-600 dark:border-gray-700 dark:bg-gray-900",
                    focusRing,
                  )}
                />
                {COLUMN_LABELS[column]}
                {column === "last4" && (
                  <span className="text-gray-500">
                    — leave off for merchant files
                  </span>
                )}
              </label>
            ))}

            {selected.length === 0 && (
              <p className="mt-1 text-sm text-gray-500">
                Pick at least one column to download a file.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p className="mt-2 grow text-sm text-gray-500 sm:mt-0">
            {rowCount === 0
              ? "No payments match this scope."
              : `${rowCount.toLocaleString()} payments · ${selected.length} columns`}
          </p>
          <Button
            variant="primary"
            className="py-1.5"
            disabled={!canDownload}
            asChild={canDownload}
          >
            {canDownload ? <a href={href()}>Download CSV</a> : <span>Download CSV</span>}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
