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
  EXPORT_COLUMN_LABELS,
  type ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

type Scope = "current" | "all"

export function ExportDialog({
  query,
  currentCount,
  allCount,
}: {
  /** The current /payments querystring — status, merchant, and search. */
  query: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("current")

  const toggle = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  // Submit columns in the table's own order, whatever order they were ticked.
  const orderedColumns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? allCount : currentCount

  const params = new URLSearchParams(scope === "all" ? "" : query)
  params.delete("page")
  params.set("columns", orderedColumns.join(","))
  if (scope === "all") params.set("scope", "all")
  const href = `/api/payments/export?${params.toString()}`

  const nothingSelected = orderedColumns.length === 0

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
            Choose the columns and how much of the table to include. The file is
            generated on the server, so it is never limited to the page on screen.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="flex flex-col gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    name="columns"
                    value={column}
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"
                  />
                  {EXPORT_COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="current"
                checked={scope === "current"}
                onChange={() => setScope("current")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"
              />
              Current filter
              <span className="text-gray-500 tabular-nums">
                {currentCount.toLocaleString()} rows
              </span>
            </label>
            <label className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-700 dark:bg-gray-950 dark:focus:ring-blue-700/30"
              />
              All payments
              <span className="text-gray-500 tabular-nums">
                {allCount.toLocaleString()} rows
              </span>
            </label>
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          {nothingSelected ? (
            <Button disabled className="gap-2">
              <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
              Download
            </Button>
          ) : (
            <Button asChild className="gap-2">
              <a href={href} download>
                <Download
                  className="-ml-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Download {rowCount.toLocaleString()} rows
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
