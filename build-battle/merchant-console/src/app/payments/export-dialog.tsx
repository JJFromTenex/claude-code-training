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
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
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

type Scope = "current" | "all"

export function ExportDialog({
  currentQuery,
  currentCount,
  allCount,
}: {
  /** Querystring for the active filters, e.g. "status=disputed". */
  currentQuery: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    new Set(DEFAULT_EXPORT_COLUMNS),
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

  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "all" ? allCount : currentCount

  const exportParams = new URLSearchParams(scope === "current" ? currentQuery : "")
  exportParams.set("scope", scope)
  exportParams.set("columns", columns.join(","))

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
            {EXPORT_COLUMNS.map((column) => (
              <label
                key={column}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                checked={scope === "current"}
                onChange={() => setScope("current")}
              />
              Current filter ({currentCount.toLocaleString()} payments)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                className="size-4 border-gray-300 text-blue-500 focus:ring-blue-500 dark:border-gray-700"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              All payments ({allCount.toLocaleString()} payments)
            </label>
          </fieldset>

          <p className="text-sm text-gray-500">
            {rowCount.toLocaleString()} payments will be exported.
          </p>
        </DialogBody>
        <DialogFooter>
          <Button
            variant="primary"
            disabled={columns.length === 0}
            asChild={columns.length > 0}
          >
            {columns.length > 0 ? (
              <a href={`/api/payments/export?${exportParams.toString()}`}>
                Download
              </a>
            ) : (
              <span>Download</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
