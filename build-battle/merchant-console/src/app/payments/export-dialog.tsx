"use client"

import { Button } from "@/components/Button"
import { Checkbox } from "@/components/Checkbox"
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
  EXPORT_COLUMN_LABELS,
  EXPORT_COLUMNS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { cx, focusRing } from "@/lib/utils"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table.
 *
 * The picker is a convenience; the server validates the column names and the
 * scope again before either reaches a file. Counts are handed down from the
 * page, which already knows both, so opening this costs no request.
 */
export function ExportDialog({
  query,
  filteredTotal,
  allTotal,
}: {
  query: string
  filteredTotal: number
  allTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [scope, setScope] = useState<ExportScope>("current")
  const [selected, setSelected] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])

  const rowCount = scope === "all" ? allTotal : filteredTotal
  const nothingSelected = selected.length === 0

  const toggle = (column: ExportColumn, checked: boolean) =>
    setSelected((current) =>
      checked
        ? EXPORT_COLUMNS.filter((c) => c === column || current.includes(c))
        : current.filter((c) => c !== column),
    )

  const href = () => {
    const params = new URLSearchParams(query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", selected.join(","))
    return `/api/payments/export?${params.toString()}`
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

      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription className="text-sm">
            Choose what goes in the file before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            {(
              [
                ["current", "Current filter", filteredTotal],
                ["all", "All payments", allTotal],
              ] as const
            ).map(([value, label, count]) => (
              <div key={value} className="flex items-center gap-2">
                <input
                  id={`scope-${value}`}
                  type="radio"
                  name="scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className={cx(
                    "size-4 shrink-0 border-gray-300 text-blue-500 accent-blue-500",
                    "dark:border-gray-700 dark:bg-gray-900",
                    focusRing,
                  )}
                />
                <label
                  htmlFor={`scope-${value}`}
                  className="select-none text-sm text-gray-900 dark:text-gray-50"
                >
                  {label}
                  <span className="ml-1 text-gray-500 dark:text-gray-500">
                    ({count.toLocaleString()} rows)
                  </span>
                </label>
              </div>
            ))}
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            {EXPORT_COLUMNS.map((column) => (
              <Checkbox
                key={column}
                id={`column-${column}`}
                label={EXPORT_COLUMN_LABELS[column]}
                checked={selected.includes(column)}
                onChange={(event) => toggle(column, event.target.checked)}
              />
            ))}
            {nothingSelected && (
              <p
                role="status"
                className="text-sm text-red-600 dark:text-red-500"
              >
                Select at least one column to download.
              </p>
            )}
          </fieldset>
        </DrawerBody>

        <DrawerFooter>
          <p className="mt-2 grow text-sm text-gray-500 sm:mt-0 dark:text-gray-500">
            {rowCount.toLocaleString()} rows · {selected.length} columns
          </p>
          <DrawerClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DrawerClose>
          {nothingSelected ? (
            <Button className="gap-2 py-1.5" disabled>
              Download
            </Button>
          ) : (
            <Button
              className="gap-2 py-1.5"
              asChild
              onClick={() => setOpen(false)}
            >
              <a href={href()} download>
                <Download
                  className="-ml-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
