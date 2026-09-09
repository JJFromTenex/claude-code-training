"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { RiCloseLine } from "@remixicon/react"
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

const controlClass = cx(
  "size-4 shrink-0 rounded border-gray-300 accent-blue-500 dark:border-gray-700",
  focusRing,
)

/**
 * Options for the payments export. Column and scope choices become query
 * parameters on the existing export route, which validates them again; the
 * checkboxes here are a convenience, not the enforcement.
 */
export function ExportDialog({
  query,
  counts,
}: {
  /** The current filter as a query string, without pagination. */
  query: string
  counts: { filtered: number; all: number }
}) {
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<ExportScope>("filtered")

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? EXPORT_COLUMNS.filter((c) => c === column || current.includes(c))
        : current.filter((c) => c !== column),
    )

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", selected.join(","))
  const href = `/api/payments/export?${params.toString()}`

  const rowCount = scope === "all" ? counts.all : counts.filtered
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
      <DrawerContent>
        <div className="flex items-start justify-between gap-x-4 border-b border-gray-200 pb-4 dark:border-gray-900">
          <div className="mt-1 flex flex-col gap-y-1">
            <DrawerTitle>Export payments</DrawerTitle>
            <DrawerDescription>
              Choose the columns and the rows. The file downloads as CSV.
            </DrawerDescription>
          </div>
          <DrawerClose asChild>
            <Button
              variant="ghost"
              className="aspect-square p-1 hover:bg-gray-100 hover:dark:bg-gray-400/10"
            >
              <RiCloseLine className="size-6" aria-hidden="true" />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        </div>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.includes(column)}
                    onChange={(event) => toggle(column, event.target.checked)}
                    className={controlClass}
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
            {!canDownload && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-500">
                Choose at least one column to download.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Rows
            </legend>
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className={controlClass}
                />
                Current filter
                <span className="tabular-nums text-gray-500">
                  · {counts.filtered.toLocaleString()} rows
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className={controlClass}
                />
                All payments
                <span className="tabular-nums text-gray-500">
                  · {counts.all.toLocaleString()} rows
                </span>
              </label>
            </div>
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {canDownload ? (
            <DrawerClose asChild>
              <Button className="w-full gap-2 sm:w-fit" asChild>
                <a href={href}>
                  <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                  Download {rowCount.toLocaleString()} rows
                </a>
              </Button>
            </DrawerClose>
          ) : (
            <Button className="w-full gap-2 sm:w-fit" disabled>
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
