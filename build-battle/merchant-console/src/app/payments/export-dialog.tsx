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
  ExportScope,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
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

const controlStyles = cx(
  "size-4 shrink-0 rounded border-gray-300 accent-blue-500 dark:border-gray-700",
  focusRing,
)

/**
 * Export options for the payments table. Builds the query string for
 * GET /api/payments/export; the server validates it and produces the file,
 * so the browser never sees more than the page it is on.
 */
export function ExportDialog({
  current,
  filteredCount,
  totalCount,
}: {
  current: { status: string; merchantId: string; search: string }
  filteredCount: number
  totalCount: number
}) {
  const [scope, setScope] = useState<ExportScope>("current")
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )

  const rowCount = scope === "all" ? totalCount : filteredCount
  const nothingSelected = selected.size === 0

  const toggle = (column: ExportColumn, on: boolean) =>
    setSelected((previous) => {
      const next = new Set(previous)
      if (on) next.add(column)
      else next.delete(column)
      return next
    })

  const href = () => {
    const query = new URLSearchParams()
    query.set("scope", scope)
    query.set(
      "columns",
      EXPORT_COLUMNS.filter((column) => selected.has(column)).join(","),
    )
    if (scope === "current") {
      if (current.status && current.status !== "all") query.set("status", current.status)
      if (current.merchantId) query.set("merchantId", current.merchantId)
      if (current.search) query.set("search", current.search)
    }
    return `/api/payments/export?${query.toString()}`
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

      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the file. The card last four stays out unless
            you add it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="current"
                checked={scope === "current"}
                onChange={() => setScope("current")}
                className={controlStyles}
              />
              <span>
                Current filter
                <span className="ml-1 tabular-nums text-gray-500">
                  · {filteredCount.toLocaleString()} payments
                </span>
              </span>
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className={controlStyles}
              />
              <span>
                All payments
                <span className="ml-1 tabular-nums text-gray-500">
                  · {totalCount.toLocaleString()} payments
                </span>
              </span>
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            {/* legend must be the fieldset's first child to name the group */}
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mb-1 flex gap-3 text-xs">
              <button
                type="button"
                onClick={() => setSelected(new Set(EXPORT_COLUMNS))}
                className={cx("text-blue-600 hover:underline dark:text-blue-500", focusRing)}
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set(DEFAULT_EXPORT_COLUMNS))}
                className={cx("text-blue-600 hover:underline dark:text-blue-500", focusRing)}
              >
                Reset to default
              </button>
            </div>
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  name="columns"
                  value={column}
                  checked={selected.has(column)}
                  onChange={(event) => toggle(column, event.target.checked)}
                  className={controlStyles}
                />
                <span>
                  {COLUMN_LABELS[column]}
                  {column === "last4" && (
                    <span className="ml-1 text-gray-500">
                      · leave off for files going to a merchant
                    </span>
                  )}
                </span>
              </label>
            ))}
          </fieldset>

          <p className="text-sm text-gray-500" aria-live="polite">
            {nothingSelected
              ? "Choose at least one column to download."
              : `${rowCount.toLocaleString()} rows · ${selected.size} of ${EXPORT_COLUMNS.length} columns`}
          </p>
        </DrawerBody>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="w-full sm:w-fit">
              Cancel
            </Button>
          </DrawerClose>
          {nothingSelected ? (
            <Button disabled className="w-full gap-2 sm:w-fit">
              <Download className="size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          ) : (
            <Button className="w-full gap-2 sm:w-fit" asChild>
              <DrawerClose asChild>
                <a href={href()}>
                  <Download className="size-4 shrink-0" aria-hidden="true" />
                  Download
                </a>
              </DrawerClose>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
