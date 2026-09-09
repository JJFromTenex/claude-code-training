"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
} from "@/lib/csv"
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

type Scope = "filtered" | "all"

export function ExportDialog({
  query,
  filteredCount,
  allCount,
  statusLabel,
}: {
  query: string
  filteredCount: number
  allCount: number
  statusLabel: string
}) {
  const [columns, setColumns] = useState<ExportColumn[]>([
    ...DEFAULT_EXPORT_COLUMNS,
  ])
  const [scope, setScope] = useState<Scope>("filtered")

  const toggleColumn = (column: ExportColumn) => {
    setColumns((current) => {
      const set = new Set(current)
      if (set.has(column)) {
        set.delete(column)
      } else {
        set.add(column)
      }
      return EXPORT_COLUMNS.filter((c) => set.has(c))
    })
  }

  const rowCount = scope === "all" ? allCount : filteredCount

  const params = new URLSearchParams(query)
  params.set("scope", scope)
  params.set("columns", columns.join(","))
  const href = `/api/payments/export?${params.toString()}`

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
        <DialogTitle>Export payments</DialogTitle>
        <DialogDescription>
          Choose the columns and scope. Card last four is off by default.
        </DialogDescription>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Columns
          </legend>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            {EXPORT_COLUMNS.map((column) => {
              const id = `export-column-${column}`
              return (
                <div key={column} className="flex items-center gap-2">
                  <input
                    id={id}
                    type="checkbox"
                    className="size-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                    checked={columns.includes(column)}
                    onChange={() => toggleColumn(column)}
                  />
                  <label
                    htmlFor={id}
                    className="text-sm text-gray-700 dark:text-gray-300"
                  >
                    {COLUMN_LABELS[column]}
                  </label>
                </div>
              )
            })}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
            Scope
          </legend>
          <div className="mt-3 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                id="export-scope-filtered"
                type="radio"
                name="export-scope"
                className="size-4 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
              />
              <label
                htmlFor="export-scope-filtered"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                Current filter · {statusLabel} · {filteredCount.toLocaleString()} rows
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="export-scope-all"
                type="radio"
                name="export-scope"
                className="size-4 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-700"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              <label
                htmlFor="export-scope-all"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                All payments · {allCount.toLocaleString()} rows
              </label>
            </div>
          </div>
        </fieldset>

        <p className="mt-4 text-sm text-gray-500">
          {rowCount.toLocaleString()} rows will be exported
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DialogClose>
          {columns.length > 0 ? (
            <Button asChild>
              <a href={href} download>
                Download CSV
              </a>
            </Button>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <Button disabled>Download CSV</Button>
              <p className="text-xs text-gray-500">
                Select at least one column.
              </p>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
