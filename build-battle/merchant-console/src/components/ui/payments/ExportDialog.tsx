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
import { EXPORT_COLUMNS, EXPORT_COLUMN_LABELS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const DEFAULT_COLUMNS = EXPORT_COLUMNS.filter((column) => column !== "last4")

type Scope = "filtered" | "all"

/**
 * Options dialog behind the payments Export button. Column choice and scope
 * are picked here; the export route (NWP-101) validates both server-side
 * regardless of what this sends. Row counts are computed server-side by
 * page.tsx and passed in, rather than fetched again from the client.
 */
export function ExportDialog({
  queryParams,
  filteredCount,
  allCount,
}: {
  queryParams: string
  filteredCount: number
  allCount: number
}) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<ExportColumn[]>(DEFAULT_COLUMNS)
  const [scope, setScope] = useState<Scope>("filtered")

  const toggleColumn = (column: ExportColumn) => {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return EXPORT_COLUMNS.filter((c) => next.has(c))
    })
  }

  const exportParams = new URLSearchParams(queryParams)
  exportParams.set("columns", columns.join(","))
  exportParams.set("scope", scope)
  const exportHref = `/api/payments/export?${exportParams.toString()}`

  const countLabel = (count: number) => `${count.toLocaleString()} payments`

  return (
    <Drawer open={open} onOpenChange={setOpen}>
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
            Choose which columns and how many rows go into the file.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                    checked={columns.includes(column)}
                    onChange={() => toggleColumn(column)}
                  />
                  {EXPORT_COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                  checked={scope === "filtered"}
                  onChange={() => setScope("filtered")}
                />
                Current filter ({countLabel(filteredCount)})
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="radio"
                  name="export-scope"
                  className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                />
                All payments ({countLabel(allCount)})
              </label>
            </div>
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {columns.length > 0 ? (
            <Button asChild>
              <a href={exportHref} onClick={() => setOpen(false)}>
                Download
              </a>
            </Button>
          ) : (
            <Button disabled>Download</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
