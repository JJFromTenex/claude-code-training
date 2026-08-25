"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  EXPORT_COLUMN_LABELS,
  ExportColumn,
  ExportScope,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

/**
 * Export options for the payments table (NWP-101).
 *
 * The counts come from the server, so the dialog never queries and never
 * exports what the browser happens to be holding. Download is an anchor: the
 * route sets the filename and the browser saves the file.
 */
export function ExportDialog({
  query,
  filteredCount,
  totalCount,
}: {
  /** The active filters, already serialized by the page. */
  query: string
  filteredCount: number
  totalCount: number
}) {
  const [selected, setSelected] = useState<readonly ExportColumn[]>(
    DEFAULT_EXPORT_COLUMNS,
  )
  const [scope, setScope] = useState<ExportScope>("filter")

  const toggle = (column: ExportColumn, checked: boolean) => {
    setSelected((current) =>
      checked
        ? EXPORT_COLUMNS.filter((c) => c === column || current.includes(c))
        : current.filter((c) => c !== column),
    )
  }

  const rowCount = scope === "all" ? totalCount : filteredCount
  const canDownload = selected.length > 0

  const href = () => {
    const params = new URLSearchParams(scope === "all" ? "" : query)
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", selected.join(","))
    return `/api/payments/export?${params.toString()}`
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose the columns and the rows. The file covers every matching
            payment, not just this page.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Rows
          </legend>
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="filter"
                checked={scope === "filter"}
                onChange={() => setScope("filter")}
                className="size-4 border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
              Current filter
              <span className="text-gray-500">
                ({filteredCount.toLocaleString()} rows)
              </span>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900"
              />
              All payments
              <span className="text-gray-500">
                ({totalCount.toLocaleString()} rows)
              </span>
            </label>
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Columns
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  name="columns"
                  value={column}
                  checked={selected.includes(column)}
                  onChange={(event) => toggle(column, event.target.checked)}
                  className="size-4 rounded border-gray-300 text-blue-500 dark:border-gray-700 dark:bg-gray-900"
                />
                {EXPORT_COLUMN_LABELS[column]}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {canDownload
              ? `${selected.length} of ${EXPORT_COLUMNS.length} columns. Card last four is off unless you add it.`
              : "Select at least one column to download."}
          </p>
        </fieldset>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" className="py-1.5">
              Cancel
            </Button>
          </DialogClose>
          {canDownload ? (
            <DialogClose asChild>
              <Button className="gap-2 py-1.5" asChild>
                <a href={href()}>
                  Download {rowCount.toLocaleString()} rows
                </a>
              </Button>
            </DialogClose>
          ) : (
            <Button className="gap-2 py-1.5" disabled>
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
