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
import { cx, focusRing } from "@/lib/utils"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  type ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

/** Human labels for the export columns; order follows EXPORT_COLUMNS. */
const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

type Scope = "current" | "all"

export function ExportDialog({
  filterParams,
  currentCount,
  allCount,
}: {
  /** The active table filter (status, merchantId, search), already stripped of empties. */
  filterParams: Record<string, string>
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("current")

  const toggle = (column: ExportColumn) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })

  // Preserve EXPORT_COLUMNS order in the URL, whatever order they were toggled.
  const orderedColumns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? allCount : currentCount
  const canDownload = orderedColumns.length > 0

  const query = new URLSearchParams(scope === "current" ? filterParams : {})
  query.set("scope", scope)
  query.set("columns", orderedColumns.join(","))
  const href = `/api/payments/export?${query.toString()}`

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
            Choose the columns and the scope. The file downloads as CSV.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="flex flex-col gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className={cx(
                      "size-4 rounded border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-950",
                      focusRing,
                    )}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="current"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                  className={cx(
                    "size-4 border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-950",
                    focusRing,
                  )}
                />
                Current filter ({currentCount.toLocaleString()})
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className={cx(
                    "size-4 border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-950",
                    focusRing,
                  )}
                />
                All payments ({allCount.toLocaleString()})
              </label>
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p className="mr-auto self-center text-sm text-gray-500">
            {canDownload
              ? `${rowCount.toLocaleString()} rows · ${orderedColumns.length} columns`
              : "Select at least one column"}
          </p>
          {canDownload ? (
            <Button asChild className="gap-2">
              <a href={href} download>
                <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                Download
              </a>
            </Button>
          ) : (
            <Button className="gap-2" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
