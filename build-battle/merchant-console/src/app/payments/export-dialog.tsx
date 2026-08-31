"use client"

import { Button } from "@/components/Button"
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/Dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/Select"
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useState } from "react"

const COLUMN_LABELS: Record<ExportColumn, string> = {
  id: "Payment ID",
  created_at: "Created",
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
  query,
  currentCount,
  allCount,
}: {
  query: string
  currentCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<Scope>("current")

  const columns = EXPORT_COLUMNS.filter((column) => selected.has(column))
  const rowCount = scope === "current" ? currentCount : allCount

  const toggle = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const params = new URLSearchParams(query)
  params.set("columns", columns.join(","))
  if (scope === "all") params.set("scope", "all")
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
        <DialogHeader>
          <DialogTitle>Export payments</DialogTitle>
          <DialogDescription>
            Choose what ships in the file. Card last four stays off unless you turn it on.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              {EXPORT_COLUMNS.map((column) => {
                const inputId = `export-column-${column}`
                return (
                  <div key={column} className="flex items-center gap-2">
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={selected.has(column)}
                      onChange={() => toggle(column)}
                      className="size-4 rounded border-gray-300 text-blue-500 focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-950"
                    />
                    <label
                      htmlFor={inputId}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      {COLUMN_LABELS[column]}
                    </label>
                  </div>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </span>
            <Select value={scope} onValueChange={(value) => setScope(value as Scope)}>
              <SelectTrigger aria-label="Export scope" className="py-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current filter</SelectItem>
                <SelectItem value="all">All payments</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-gray-500">
              {rowCount.toLocaleString()} {rowCount === 1 ? "payment" : "payments"} will be
              exported.
            </p>
          </div>
        </DialogBody>
        <DialogFooter>
          <p className="text-sm text-gray-500" role="status">
            {columns.length === 0 && "Select at least one column."}
          </p>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="secondary" className="py-1.5">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              className="gap-2 py-1.5"
              disabled={columns.length === 0}
              asChild={columns.length > 0}
            >
              {columns.length > 0 ? (
                <a href={href}>
                  <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                  Download
                </a>
              ) : (
                <span>
                  <Download className="-ml-0.5 size-4 shrink-0" aria-hidden="true" />
                  Download
                </span>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
