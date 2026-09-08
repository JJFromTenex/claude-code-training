"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import {
  DEFAULT_COLUMNS,
  EXPORT_COLUMNS,
  type ExportColumn,
} from "@/lib/csv"
import { Download } from "lucide-react"
import { useMemo, useState } from "react"

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

export function ExportDialog({
  filters,
  filteredCount,
  allCount,
}: {
  filters: Record<string, string>
  filteredCount: number
  allCount: number
}) {
  const [selected, setSelected] = useState<Set<ExportColumn>>(
    () => new Set(DEFAULT_COLUMNS),
  )
  const [scope, setScope] = useState<"filtered" | "all">("filtered")

  const toggle = (column: ExportColumn) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(column)) next.delete(column)
      else next.add(column)
      return next
    })
  }

  const orderedColumns = useMemo(
    () => EXPORT_COLUMNS.filter((column) => selected.has(column)),
    [selected],
  )

  const href = useMemo(() => {
    const params = new URLSearchParams()
    if (scope === "filtered") {
      for (const [key, value] of Object.entries(filters)) {
        if (value) params.set(key, value)
      }
    }
    params.set("scope", scope)
    params.set("columns", orderedColumns.join(","))
    return `/api/payments/export?${params.toString()}`
  }, [filters, scope, orderedColumns])

  const canDownload = orderedColumns.length > 0

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
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          <fieldset className="space-y-2">
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
              Current filter ({filteredCount.toLocaleString()} payments)
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="export-scope"
                value="all"
                checked={scope === "all"}
                onChange={() => setScope("all")}
              />
              All payments ({allCount.toLocaleString()})
            </label>
          </fieldset>

          <fieldset className="space-y-2">
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
                  checked={selected.has(column)}
                  onChange={() => toggle(column)}
                />
                {COLUMN_LABELS[column]}
              </label>
            ))}
          </fieldset>
        </DrawerBody>
        <DrawerFooter>
          <Button
            variant="secondary"
            disabled={!canDownload}
            onClick={() => {
              if (canDownload) window.location.assign(href)
            }}
          >
            Download
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
