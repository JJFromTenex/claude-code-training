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
import type { ExportColumn } from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created at",
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
  filteredCount,
  allCount,
  columns,
  defaultColumns,
}: {
  query: string
  filteredCount: number
  allCount: number
  columns: readonly ExportColumn[]
  defaultColumns: readonly ExportColumn[]
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(defaultColumns),
  )
  const [scope, setScope] = useState<"current" | "all">("current")

  const toggle = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const empty = selected.size === 0
  const rowCount = scope === "current" ? filteredCount : allCount

  const params = new URLSearchParams(scope === "current" ? query : undefined)
  params.set("scope", scope)
  params.set("columns", columns.filter((c) => selected.has(c)).join(","))
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
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose the columns and scope for the CSV file.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <div key={column} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`export-column-${column}`}
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className={cx(
                      "size-4 rounded border-gray-300 accent-blue-600 dark:border-gray-800",
                      focusRing,
                    )}
                  />
                  <label
                    htmlFor={`export-column-${column}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {COLUMN_LABELS[column]}
                  </label>
                </div>
              ))}
            </div>
            {empty && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-500">
                Select at least one column.
              </p>
            )}
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {(
                [
                  ["current", "Current filter"],
                  ["all", "All payments"],
                ] as const
              ).map(([value, label]) => (
                <div key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    id={`export-scope-${value}`}
                    name="export-scope"
                    value={value}
                    checked={scope === value}
                    onChange={() => setScope(value)}
                    className={cx("size-4 accent-blue-600", focusRing)}
                  />
                  <label
                    htmlFor={`export-scope-${value}`}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {label}
                  </label>
                </div>
              ))}
            </div>
          </fieldset>

          <p aria-live="polite" className="text-sm text-gray-500">
            {rowCount.toLocaleString()} {rowCount === 1 ? "row" : "rows"} will
            be exported.
          </p>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          <Button variant="primary" className="py-1.5" disabled={empty} asChild={!empty}>
            {empty ? (
              <span>Download</span>
            ) : (
              <DrawerClose asChild>
                <a href={href}>Download</a>
              </DrawerClose>
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
