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
  COLUMN_LABELS,
  DEFAULT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

export function ExportDialog({
  filterQuery,
  filteredCount,
  allCount,
  activeStatus,
}: {
  filterQuery: string
  filteredCount: number
  allCount: number
  activeStatus: string | undefined
}) {
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_COLUMNS),
  )
  const [scope, setScope] = useState<"filtered" | "all">("filtered")

  function toggleColumn(col: ExportColumn) {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(col)) {
        next.delete(col)
      } else {
        next.add(col)
      }
      return next
    })
  }

  function buildExportUrl() {
    const params = new URLSearchParams()
    params.set("columns", Array.from(columns).join(","))
    params.set("scope", scope)
    if (scope === "filtered" && filterQuery) {
      const filterParams = new URLSearchParams(filterQuery)
      filterParams.forEach((value, key) => {
        params.set(key, value)
      })
    }
    return `/api/payments/export?${params.toString()}`
  }

  const displayCount = scope === "filtered" ? filteredCount : allCount
  const canDownload = columns.size > 0

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
            Choose which columns to include and the scope of the export.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="filtered"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                  className="accent-blue-500"
                />
                Current filter ({filteredCount.toLocaleString()} payments)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="scope"
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="accent-blue-500"
                />
                All payments ({allCount.toLocaleString()} payments)
              </label>
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 space-y-2">
              {EXPORT_COLUMNS.map((col) => (
                <label
                  key={col}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={columns.has(col)}
                    onChange={() => toggleColumn(col)}
                    className="accent-blue-500"
                  />
                  {COLUMN_LABELS[col]}
                </label>
              ))}
            </div>
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {canDownload ? (
            <DrawerClose asChild>
              <Button asChild>
                <a href={buildExportUrl()}>
                  Download {displayCount.toLocaleString()} rows
                </a>
              </Button>
            </DrawerClose>
          ) : (
            <Button disabled>Select at least one column</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
