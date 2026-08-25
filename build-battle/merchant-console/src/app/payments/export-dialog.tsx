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
  COLUMN_LABELS,
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table (NWP-101).
 *
 * Ops picks the columns (card last four off by default) and the scope. The
 * download is a plain link to the export route, which re-validates the columns
 * server-side — this dialog is the convenience, not the enforcement.
 */
export function PaymentsExportDialog({
  current,
  currentCount,
  allCount,
}: {
  current: { status: string; merchantId: string; search: string }
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Record<ExportColumn, boolean>>(
    () =>
      Object.fromEntries(
        EXPORT_COLUMNS.map((column) => [
          column,
          DEFAULT_EXPORT_COLUMNS.includes(column),
        ]),
      ) as Record<ExportColumn, boolean>,
  )
  const [scope, setScope] = useState<"current" | "all">("current")

  // Keep the CSV's column order stable regardless of toggle order.
  const chosen = EXPORT_COLUMNS.filter((column) => selected[column])
  const rowCount = scope === "all" ? allCount : currentCount

  const toggle = (column: ExportColumn) =>
    setSelected((prev) => ({ ...prev, [column]: !prev[column] }))

  const params = new URLSearchParams()
  params.set("scope", scope)
  params.set("columns", chosen.join(","))
  if (scope === "current") {
    if (current.status && current.status !== "all")
      params.set("status", current.status)
    if (current.merchantId) params.set("merchantId", current.merchantId)
    if (current.search) params.set("search", current.search)
  }
  const exportUrl = `/api/payments/export?${params.toString()}`

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
            Choose the columns and rows to include in the CSV.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                checked={scope === "current"}
                onChange={() => setScope("current")}
                className="size-4 accent-blue-500"
              />
              Current filter
              <span className="text-gray-500">
                ({currentCount.toLocaleString()})
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 accent-blue-500"
              />
              All payments
              <span className="text-gray-500">
                ({allCount.toLocaleString()})
              </span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
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
                  checked={selected[column]}
                  onChange={() => toggle(column)}
                  className="size-4 accent-blue-500"
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          {chosen.length === 0 ? (
            <Button variant="primary" disabled>
              Download
            </Button>
          ) : (
            <Button variant="primary" asChild>
              <a href={exportUrl}>
                Download {rowCount.toLocaleString()} rows
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
