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
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, ExportColumn } from "@/lib/csv"
import { Download } from "lucide-react"
import { useEffect, useState } from "react"

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

/**
 * Export options for the payments table. Column set and scope are chosen
 * here; the download itself is a plain navigation to GET /api/payments/export
 * so the server — not this component — does the filtering and formatting.
 */
export function PaymentsExportDialog({
  query,
  filteredTotal,
}: {
  /** The current filter query string, without a leading "?". */
  query: string
  filteredTotal: number
}) {
  const [open, setOpen] = useState(false)
  const [columns, setColumns] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_EXPORT_COLUMNS),
  )
  const [scope, setScope] = useState<"filtered" | "all">("filtered")
  const [allTotal, setAllTotal] = useState<number | null>(null)

  useEffect(() => {
    if (!open || scope !== "all" || allTotal !== null) return
    let cancelled = false
    fetch("/api/payments")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setAllTotal(data.total ?? 0)
      })
      .catch(() => {
        if (!cancelled) setAllTotal(0)
      })
    return () => {
      cancelled = true
    }
  }, [open, scope, allTotal])

  const toggleColumn = (column: ExportColumn) => {
    setColumns((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const hasColumns = columns.size > 0
  const rowCount = scope === "all" ? allTotal : filteredTotal

  const params = new URLSearchParams(scope === "filtered" ? query : "")
  params.delete("page")
  params.set("scope", scope)
  for (const column of EXPORT_COLUMNS) {
    if (columns.has(column)) params.append("columns", column)
  }
  const downloadHref = `/api/payments/export?${params.toString()}`

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
          <DrawerDescription>
            Choose which columns and how many payments go into the CSV.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody className="flex flex-col gap-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="filtered"
                checked={scope === "filtered"}
                onChange={() => setScope("filtered")}
              />
              Current filter
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              All payments
            </label>
            <p className="text-sm text-gray-500">
              {rowCount === null
                ? "Loading row count…"
                : `${rowCount.toLocaleString()} payment${rowCount === 1 ? "" : "s"} will be exported.`}
            </p>
          </fieldset>

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
                  checked={columns.has(column)}
                  onChange={() => toggleColumn(column)}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {hasColumns ? (
            <Button asChild>
              <a href={downloadHref}>Download</a>
            </Button>
          ) : (
            <Button disabled>Download</Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
