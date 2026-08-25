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
  type ExportColumn,
  type ExportScope,
} from "@/lib/csv"
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
 * Export options for the payments table.
 *
 * The counts come in as props because the page has already run the query to
 * render the table — asking the server again just to show a number would be
 * a second trip for something it already knows.
 */
export function ExportDialog({
  query,
  currentCount,
  allCount,
}: {
  /** The active filter query string, so "current filter" means what the table shows. */
  query: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("current")

  const toggle = (column: ExportColumn) =>
    setSelected((previous) =>
      previous.includes(column)
        ? previous.filter((name) => name !== column)
        : [...previous, column],
    )

  const rowCount = scope === "all" ? allCount : currentCount
  const disabled = selected.length === 0

  const href = () => {
    const params = new URLSearchParams(scope === "all" ? "" : query)
    params.set("scope", scope)
    params.set("columns", selected.join(","))
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
          <DrawerDescription>
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            {(
              [
                ["current", "Current filter", currentCount],
                ["all", "All payments", allCount],
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
                  className="size-4 accent-blue-500"
                />
                <span>{label}</span>
                <span className="text-gray-500 dark:text-gray-500">
                  {count.toLocaleString()} rows
                </span>
              </label>
            ))}
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
                  checked={selected.includes(column)}
                  onChange={() => toggle(column)}
                  className="size-4 accent-blue-500"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
            {disabled && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <Button variant="secondary" disabled={disabled} asChild={!disabled}>
            {disabled ? (
              <span>Download</span>
            ) : (
              <a href={href()}>
                Download {rowCount.toLocaleString()} rows
              </a>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
