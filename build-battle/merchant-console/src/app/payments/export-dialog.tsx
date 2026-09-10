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
import { Download } from "lucide-react"
import { useState } from "react"

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

/**
 * Export options for the payments table.
 *
 * Both row counts are handed down from the server component, which already
 * has them, so opening this does not cost a request. The column list posts as
 * an ordered, comma-separated param; the server re-validates it, and the
 * disabled Download here is a convenience rather than the enforcement.
 */
export function PaymentsExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<"filter" | "all">("filter")

  const toggle = (column: ExportColumn) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : // Keep the canonical column order rather than click order.
          EXPORT_COLUMNS.filter((c) => c === column || current.includes(c)),
    )

  const rowCount = scope === "all" ? totalCount : filteredCount
  const params = new URLSearchParams(query)
  params.set("columns", selected.join(","))
  params.set("scope", scope)
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

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(
                [
                  ["filter", "Current filter", filteredCount],
                  ["all", "All payments", totalCount],
                ] as const
              ).map(([value, label, count]) => (
                <label
                  key={value}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className="size-4 accent-blue-600"
                  />
                  <span>{label}</span>
                  <span className="text-gray-500 tabular-nums">
                    {count.toLocaleString()} rows
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                    className="size-4 rounded accent-blue-600"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {selected.length === 0 && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p className="mr-auto self-center text-sm text-gray-500">
            {rowCount.toLocaleString()} rows · {selected.length}{" "}
            {selected.length === 1 ? "column" : "columns"}
          </p>
          {selected.length === 0 ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href} download>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
