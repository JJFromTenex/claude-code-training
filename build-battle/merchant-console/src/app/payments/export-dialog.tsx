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
  EXPORT_COLUMN_LABELS,
  ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useId, useState } from "react"

type Scope = "current" | "all"

export function ExportDialog({
  filterQuery,
  currentTotal,
  allTotal,
}: {
  /** The payments page's current filter query string, e.g. "status=disputed". */
  filterQuery: string
  currentTotal: number
  allTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("current")
  const scopeName = useId()

  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))

  const toggleColumn = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const exportUrl = () => {
    const params = new URLSearchParams(filterQuery)
    params.set("scope", scope)
    params.set("columns", columns.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  const handleDownload = () => {
    window.location.assign(exportUrl())
    setOpen(false)
  }

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
            Choose which columns and how many rows to include.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              <label
                htmlFor={`${scopeName}-current`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`${scopeName}-current`}
                  type="radio"
                  name={scopeName}
                  value="current"
                  checked={scope === "current"}
                  onChange={() => setScope("current")}
                  className="accent-blue-600 dark:accent-blue-500"
                />
                Current filter
                <span className="text-gray-500">
                  ({currentTotal.toLocaleString()} payments)
                </span>
              </label>
              <label
                htmlFor={`${scopeName}-all`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  id={`${scopeName}-all`}
                  type="radio"
                  name={scopeName}
                  value="all"
                  checked={scope === "all"}
                  onChange={() => setScope("all")}
                  className="accent-blue-600 dark:accent-blue-500"
                />
                All payments
                <span className="text-gray-500">
                  ({allTotal.toLocaleString()} payments)
                </span>
              </label>
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 flex flex-col gap-2">
              {EXPORT_COLUMNS.map((column) => {
                const inputId = `${scopeName}-col-${column}`
                return (
                  <label
                    key={column}
                    htmlFor={inputId}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={selected.has(column)}
                      onChange={() => toggleColumn(column)}
                      className="accent-blue-600 dark:accent-blue-500"
                    />
                    {EXPORT_COLUMN_LABELS[column]}
                  </label>
                )
              })}
            </div>
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          <Button
            variant="primary"
            disabled={columns.length === 0}
            onClick={handleDownload}
          >
            Download
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
