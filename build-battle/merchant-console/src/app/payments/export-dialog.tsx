"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
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
  created_at: "Date",
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
  currentCount,
  allCount,
}: {
  query: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("filtered")

  const toggle = (column: ExportColumn) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  // Canonical order, never toggle order — unchecking then rechecking a
  // column must not move it to the end of the export.
  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? allCount : currentCount

  const downloadHref = (() => {
    const params = new URLSearchParams(query)
    params.set("columns", columns.join(","))
    if (scope === "all") params.set("scope", "all")
    else params.delete("scope")
    return `/api/payments/export?${params.toString()}`
  })()

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
        </DialogHeader>
        <DialogBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {EXPORT_COLUMNS.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                  />
                  {COLUMN_LABELS[column]}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Export
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
              />
              Current filter ({currentCount.toLocaleString()} payments)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                checked={scope === "all"}
                onChange={() => setScope("all")}
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
              />
              All payments ({allCount.toLocaleString()} payments)
            </label>
          </fieldset>
        </DialogBody>
        <DialogFooter>
          <p className="mr-auto self-center text-sm text-gray-500 sm:mr-0">
            {rowCount.toLocaleString()} payments will be exported
          </p>
          <Button disabled={columns.length === 0} asChild={columns.length > 0}>
            {columns.length > 0 ? (
              <a href={downloadHref}>Download</a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
